// bot.ts
import { Builder, Browser, By, until, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { startWebSocketServer } from "./ws";

const MEET_URL = "https://meet.google.com/rbq-xawq-chm";

enum MeetingEndReason {
  REMOVED = "removed",
  ENDED = "ended",
  ALONE = "alone",
}

async function openMeet(driver: WebDriver) {
  await driver.get(MEET_URL);

  // Accept "Got it" popup
  try {
    const popupButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Got it")]')),
      10000
    );
    await popupButton.click();
  } catch (e) {}

  // Fill name if prompted
  try {
    const nameInput = await driver.wait(
      until.elementLocated(By.xpath('//input[@placeholder="Your name"]')),
      5000
    );
    await nameInput.clear();
    await nameInput.sendKeys("Meeting bot");
  } catch (e) {}

  // Click "Ask to join"
  try {
    const joinButton = await driver.wait(
      until.elementLocated(By.xpath('//span[contains(text(), "Ask to join")]')),
      10000
    );
    await joinButton.click();
  } catch (e) {}
}

async function muteMeetAudio(driver: WebDriver) {
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
  } catch (e) {}

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
  } catch (e) {}
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
  await driver.executeScript(`
    (async () => {
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise(res => ws.onopen = res);

      await new Promise(res => setTimeout(res, 3000));

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp8,opus",
        videoBitsPerSecond: 1800000
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && ws.readyState === 1) {
          ws.send(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (ws.readyState === 1) ws.close();
      };

      mediaRecorder.start(10000); // 10-second chunks
      window.mediaRecorder = mediaRecorder;
      window.ws = ws;

      window.stopRecording = () => {
        try {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          if (ws && ws.readyState === 1) {
            ws.close();
          }
        } catch (err) {}
      };
    })();
  `);
}

async function waitForMeetingToEndOrAlone(
  driver: WebDriver
): Promise<MeetingEndReason> {
  let aloneSince: number | null = null;
  const ALONE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  while (true) {
    let participantCount = 1;
    try {
      // Try to get participant count from the Meet UI (top right button)
      const countElem = await driver.findElement(
        By.css('[aria-label^="Participants"]')
      );
      const label = await countElem.getAttribute("aria-label");
      const match = label.match(/(\d+)/);
      if (match) participantCount = parseInt(match[1], 10);
    } catch (e) {
      // Fallback: count participant tiles
      try {
        const tiles = await driver.findElements(By.css('div[role="listitem"]'));
        participantCount = tiles.length;
      } catch (e2) {
        participantCount = 1;
      }
    }

    // Check for meeting end or removal
    try {
      await driver.findElement(
        By.xpath("//span[contains(text(), 'You’ve been removed')]")
      );
      return MeetingEndReason.REMOVED;
    } catch (e) {}
    try {
      await driver.findElement(
        By.xpath("//span[contains(text(), 'Meeting ended')]")
      );
      return MeetingEndReason.ENDED;
    } catch (e) {}

    // Check if alone
    if (participantCount <= 1) {
      if (!aloneSince) aloneSince = Date.now();
      if (Date.now() - aloneSince > ALONE_TIMEOUT) {
        console.log("Alone for 3 minutes, exiting...");
        return MeetingEndReason.ALONE;
      }
    } else {
      aloneSince = null;
    }

    await driver.sleep(5000); // Check every 5 seconds
  }
}

async function main() {
  startWebSocketServer(3001);
  const driver = await getDriver();
  await openMeet(driver);
  await muteMeetAudio(driver);
  await new Promise((x) => setTimeout(x, 20000)); // Wait for host to admit
  await startScreenshare(driver);

  // Wait for meeting end or alone timeout
  const reason = await waitForMeetingToEndOrAlone(driver);

  // Stop recording gracefully before quitting
  try {
    await driver.executeScript(
      `if(window.stopRecording) window.stopRecording();`
    );
    await driver.sleep(2000); // Give time for recorder to finish
  } catch (e) {
    console.log("Could not stop recording gracefully:", e);
  }

  await driver.quit();
  process.exit(0);
}

main();
