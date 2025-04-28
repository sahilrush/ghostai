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
function wait(delayInMS) {
             return new Promise((resolve) => setTimeout(resolve, delayInMS));
         }
 
         function startRecording(stream, lengthInMS) {
             let recorder = new MediaRecorder(stream);
             let data = [];
             
             recorder.ondataavailable = (event) => data.push(event.data);
             recorder.start();
             
             let stopped = new Promise((resolve, reject) => {
                 recorder.onstop = resolve;
                 recorder.onerror = (event) => reject(event.name);
             });
             
             let recorded = wait(lengthInMS).then(() => {
                 if (recorder.state === "recording") {
                 recorder.stop();
                 }
             });
             
             return Promise.all([stopped, recorded]).then(() => data);
         }
       
         console.log("before mediadevices")
         window.navigator.mediaDevices.getDisplayMedia({
             video: {
               displaySurface: "browser"
             },
             audio: true,
             preferCurrentTab: true
         }).then(async stream => {
             // stream should be streamed via WebRTC to a server
             console.log("before start recording")
             const recordedChunks = await startRecording(stream, 20000);
             console.log("after start recording")
             let recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
             const recording = document.createElement("video");
             recording.src = URL.createObjectURL(recordedBlob);
             const downloadButton = document.createElement("a");
             downloadButton.href = recording.src;
             downloadButton.download = "RecordedVideo.webm";    
             downloadButton.click();
             console.log("after download button click")
         })
`);
  console.log(response);
}

async function main() {
  const driver = await getDriver();
  await meetingbot(driver);
  driver.sleep(10000);

  // wait until admin lets u join
  await startScreenShare(driver);
  driver.sleep(100000);
}

main();
