// bot.ts
import { Builder, Browser, By, until, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { startWebSocketServer } from "./ws";
import { CHROME_CONSTANTS } from "./constants";

// Logging utility
const log = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
  },
};

const MEET_URL = "https://meet.google.com/rbq-xawq-chm";

enum MeetingEndReason {
  REMOVED = "removed",
  ENDED = "ended",
  ALONE = "alone",
}

async function openMeet(driver: WebDriver) {
  log.info("Opening Google Meet...");
  await driver.get(MEET_URL);

  // Accept "Got it" popup
  try {
    const popupButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Got it")]')),
      10000
    );
    await popupButton.click();
    log.info("Accepted 'Got it' popup");
  } catch (e) {
    log.warn("No 'Got it' popup found or timed out");
  }

  // Fill name if prompted
  try {
    const nameInput = await driver.wait(
      until.elementLocated(By.xpath('//input[@placeholder="Your name"]')),
      5000
    );
    await nameInput.clear();
    await nameInput.sendKeys("Meeting bot");
    log.info("Filled in bot name");
  } catch (e) {
    log.warn("No name input found or timed out");
  }

  // Click "Ask to join"
  try {
    const joinButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Ask to join")]')),
      10000
    );
    await joinButton.click();
    log.info("Clicked 'Ask to join' button");
  } catch (e) {
    log.error("Failed to click 'Ask to join' button:", e);
  }
}

async function muteMeetAudio(driver: WebDriver) {
  log.info("Muting audio...");
  // Mute microphone
  try {
    const micButton = await driver.wait(
      until.elementLocated(
        By.css(
          '[aria-label*="Turn off microphone"], [aria-label*="Mute microphone"]'
        )
      ),
      5000
    );
    await micButton.click();
    log.info("Microphone muted");
  } catch (e) {
    log.warn("Failed to mute microphone:", e);
  }

  // Mute speakers (if available)
  try {
    const moreOptionsButton = await driver.findElement(
      By.css('[aria-label="More options"]')
    );
    await moreOptionsButton.click();
    await driver.sleep(500);

    const soundButton = await driver.findElement(
      By.xpath("//span[contains(text(), 'Turn off sound')]")
    );
    await soundButton.click();
    log.info("Speakers muted");
  } catch (e) {
    log.warn("Failed to mute speakers:", e);
  }
}

async function getDriver() {
  const options = new Options();
  options.addArguments(
    "--disable-blink-features=AutomationControlled",
    "--use-fake-ui-for-media-stream",
    "--window-size=1920,1080",
    "--auto-select-desktop-capture-source=[RECORD]",
    "--enable-usermedia-screen-capturing",
    "--allow-running-insecure-content",
    "--disable-notifications",
    "--no-sandbox",
    "--disable-gpu"
    // "--headless" // Uncomment for headless mode
  );
  return await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();
}

async function startScreenshare(driver: WebDriver) {
  log.info("Starting screen share recording...");
  await driver.executeScript(`
        (async () => {
        const ws = new WebSocket('ws://localhost:3001');
        let wsReady = false;

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
            wsReady = true;
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            wsReady = false;
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
            wsReady = false;
        };

        const mediaStreamOptions = ${JSON.stringify(
          CHROME_CONSTANTS.MEDIA_STREAM_OPTIONS
        )};
        const stream = await navigator.mediaDevices.getDisplayMedia(mediaStreamOptions);

        const audioContext = new AudioContext();
        const audioEl1 = document.querySelectorAll("audio")[0];
        const audioEl2 = document.querySelectorAll("audio")[1];
        const audioEl3 = document.querySelectorAll("audio")[2];
        const audioStream1 = audioContext.createMediaStreamSource(audioEl1.srcObject)
        const audioStream2 = audioContext.createMediaStreamSource(audioEl2.srcObject)
        const audioStream3 = audioContext.createMediaStreamSource(audioEl3.srcObject)

        const dest = audioContext.createMediaStreamDestination();
        audioStream1.connect(dest)
        audioStream2.connect(dest)
        audioStream3.connect(dest)

        const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        const mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: "video/webm; codecs=vp8,opus",
            timeSlice: 10000,
            videoBitsPerSecond: 1800000,
        });

        console.log("Starting media recording...");
        mediaRecorder.start(10000);

        mediaRecorder.ondataavailable = (event) => {
            if (wsReady) {
            try {
                ws.send(event.data);
                console.log('Sent data');
            } catch (error) {
                console.error('Error sending chunk:', error);
            }
            } else {
            console.error('WebSocket is not ready to send data');
            }
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            ws.close();
            console.log('Media recording stopped');
        };

        window.stopRecording = () => {
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                ws.close();
            }
        };
        })();
    `);
  log.info("Screen share recording started");
}

async function waitForMeetingToEndOrAlone(
  driver: WebDriver
): Promise<MeetingEndReason> {
  log.info("Waiting for meeting to end or alone timeout...");
  let aloneSince: number | null = null;
  const ALONE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  while (true) {
    let participantCount = 1;
    try {
      // Method 1: Try to get participant count from the Meet UI (top right button)
      const countElem = await driver.findElement(
        By.css('[aria-label^="Participants"]')
      );
      const label = await countElem.getAttribute("aria-label");
      const match = label.match(/(\d+)/);
      if (match) {
        participantCount = parseInt(match[1], 10);
        log.debug(`Method 1 - Participant count from UI: ${participantCount}`);
      }
    } catch (e) {
      log.debug("Method 1 failed to get participant count");
    }

    // Method 2: Count participant tiles
    try {
      const tiles = await driver.findElements(By.css('div[role="listitem"]'));
      const tileCount = tiles.length;
      log.debug(`Method 2 - Participant tiles count: ${tileCount}`);
      // Use the higher count between methods
      participantCount = Math.max(participantCount, tileCount);
    } catch (e) {
      log.debug("Method 2 failed to get participant count");
    }

    // Method 3: Check for active video streams
    try {
      const videoElements = await driver.findElements(By.css("video[src]"));
      const videoCount = videoElements.length;
      log.debug(`Method 3 - Active video streams: ${videoCount}`);
      // Use the higher count between methods
      participantCount = Math.max(participantCount, videoCount);
    } catch (e) {
      log.debug("Method 3 failed to get participant count");
    }

    // Method 4: Check for participant names
    try {
      const nameElements = await driver.findElements(
        By.css("[data-participant-id]")
      );
      const nameCount = nameElements.length;
      log.debug(`Method 4 - Participant names count: ${nameCount}`);
      // Use the higher count between methods
      participantCount = Math.max(participantCount, nameCount);
    } catch (e) {
      log.debug("Method 4 failed to get participant count");
    }

    log.debug(`Final participant count: ${participantCount}`);

    // Check for meeting end or removal
    try {
      await driver.findElement(
        By.xpath("//span[contains(text(), 'You've been removed')]")
      );
      log.info("Meeting ended: User was removed");
      return MeetingEndReason.REMOVED;
    } catch (e) {}
    try {
      await driver.findElement(
        By.xpath("//span[contains(text(), 'Meeting ended')]")
      );
      log.info("Meeting ended: Meeting was ended");
      return MeetingEndReason.ENDED;
    } catch (e) {}

    // Check if alone
    if (participantCount <= 1) {
      if (!aloneSince) {
        aloneSince = Date.now();
        log.info("Meeting is empty, starting alone timer");
      }
      if (Date.now() - aloneSince > ALONE_TIMEOUT) {
        log.info("Alone for 3 minutes, exiting...");
        return MeetingEndReason.ALONE;
      }
    } else {
      if (aloneSince) {
        log.info(
          `Participants detected (${participantCount}), resetting alone timer`
        );
        aloneSince = null;
      }
    }

    await driver.sleep(5000); // Check every 5 seconds
  }
}

async function main() {
  log.info("Starting recording process...");
  startWebSocketServer(3001);
  const driver = await getDriver();
  await openMeet(driver);
  await muteMeetAudio(driver);
  log.info("Waiting for host to admit...");
  await new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
  await startScreenshare(driver);

  // Wait for meeting end or alone timeout
  const reason = await waitForMeetingToEndOrAlone(driver);
  log.info(`Meeting ended with reason: ${reason}`);

  // Stop recording gracefully before quitting
  try {
    log.info("Stopping recording...");
    await driver.executeScript(
      `if(window.stopRecording) window.stopRecording();`
    );
    await driver.sleep(2000); // Give time for recorder to finish
    log.info("Recording stopped successfully");
  } catch (e) {
    log.error("Could not stop recording gracefully:", e);
  }

  log.info("Closing browser...");
  await driver.quit();
  log.info("Process completed successfully");
  process.exit(0);
}

main();
