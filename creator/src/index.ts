import { Builder, Browser, By, Key, until } from "selenium-webdriver";

async function main() {
  let driver = await new Builder().forBrowser(Browser.CHROME).build();
  try {
    await driver.get("https://www.google.com/ncr");
    await driver.findElement(By.name("q")).sendKeys("pornhub", Key.RETURN);
    await driver.wait(until.titleIs("pornhub - Google Search"), 10000000);
  } finally {
    await driver.quit();
  }
}

main();
