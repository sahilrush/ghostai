import { Builder, Browser, By, until, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";
import { CHROME_CONSTANTS } from "./constants";

async function meetingbot(driver: WebDriver) {
  try {
    await driver.get("https://meet.google.com/ymk-tzzy-tzz");

    const popUp = await driver.wait(
      until.elementLocated(By.xpath("//span[contains(text(),'Got it')]")),
      20000
    );
    await popUp.click();
    const nameInput = await driver.wait(
      until.elementLocated(By.css("input[aria-label='Your name']")),
      20000
    );
    await nameInput.clear();
    await nameInput.click();
    await nameInput.sendKeys("Meeting bot");

    const joinButton = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//span[contains(text(),'Ask to join') or contains(text(),'Join')]"
        )
      ),
      20000
    );
    await joinButton.click();
    driver.sleep(10000);
  } finally {
    // await driver.quit();
  }
}

async function getDriver() {
  const options = new Options();
  options.addArguments("--enable-usermedia-screen-capturing");
  options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
  options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
  options.addArguments("--use-fake-ui-for-media-stream");
  options.addArguments("--disable-blink-features=AutomationControlled");
  options.addArguments("--window-size=1080,720");

  let driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  return driver;
}

async function startScreenShare(driver: WebDriver) {
  const response = await driver.executeScript(`
   (async () => {
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

        // Store recording data in array instead of sending via WebSocket // webrtc
        const recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                console.log('Recorded chunk:', event.data.size, 'bytes');
            }
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            console.log('Media recording stopped');
            
            // Optionally create a downloadable blob from the recorded chunks
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            // You could create a download link or handle the blob as needed
            console.log('Recording complete, blob URL:', url);
            
            // Example: create a download link
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            a.href = url;
            a.download = 'screen-recording.webm';
            a.click();
            
            // Revoke the blob URL
            window.URL.revokeObjectURL(url);
        };
        
        // Expose mediaRecorder to global scope for the stop function
        window.mediaRecorder = mediaRecorder;
        })();
`);
  console.log(response);

  driver.sleep(10000);
}

async function main() {
  const driver = await getDriver();
  await meetingbot(driver);
  driver.sleep(10000);

  // wait until admin lets u join
  await startScreenShare(driver);
}

main();
