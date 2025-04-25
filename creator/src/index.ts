import { Builder, Browser, By, Key, until } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome";

async function main() {
  const options = new Options();
  options.addArguments("--disable-blink-features=AutomationControlled");
  options.addArguments("--use-fake-ui-for-media-stream");

  let driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  try {
    await driver.get("https://meet.google.com/rds-fxai-xbo");

    const popUp = await driver.wait(
      until.elementLocated(By.xpath("//span[contains(text(),'Got it')]")),
      20000
    );
    await popUp.click();

    await driver.sleep(3000);

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

    await driver.wait(until.elementLocated(By.id("sdalkdasd")), 1000000);
  } finally {
    await driver.quit();
  }
}

main();
