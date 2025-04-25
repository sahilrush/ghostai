import { Builder, Browser, By, until, WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

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
  options.addArguments("--disable-blink-features=AutomationControlled");
  options.addArguments("--use-fake-ui-for-media-stream");
  options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
  options.addArguments("--window-size=1080,720");
  options.addArguments("-enable-usermedia-screen-capturing");

  let driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  return driver;
}

async function startScreenShare(driver: WebDriver) {
  const response = await driver.executeScript(`
window.navigator.mediaDevices.getDisplayMedia().then((stream) => {
  const videoEl = document.createElement("video");
  videoEl.srcObject = stream;
  videoEl.play();
  document.body.appendChild(videoEl);
});
`);
  console.log(response);

  driver.sleep(10000);
}

async function main() {
  const driver = await getDriver();
  await meetingbot(driver);
  // wait until admin lets u join
  await startScreenShare(driver);
}

main();
