"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const selenium_webdriver_1 = require("selenium-webdriver");
const chrome_1 = require("selenium-webdriver/chrome");
function meetingbot(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield driver.get("https://meet.google.com/ymk-tzzy-tzz");
            const popUp = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath("//span[contains(text(),'Got it')]")), 20000);
            yield popUp.click();
            const nameInput = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.css("input[aria-label='Your name']")), 20000);
            yield nameInput.clear();
            yield nameInput.click();
            yield nameInput.sendKeys("Meeting bot");
            const joinButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath("//span[contains(text(),'Ask to join') or contains(text(),'Join')]")), 20000);
            yield joinButton.click();
            driver.sleep(10000);
        }
        finally {
            // await driver.quit();
        }
    });
}
function getDriver() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = new chrome_1.Options();
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--use-fake-ui-for-media-stream");
        options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
        options.addArguments("--window-size=1080,720");
        options.addArguments("-enable-usermedia-screen-capturing");
        let driver = yield new selenium_webdriver_1.Builder()
            .forBrowser(selenium_webdriver_1.Browser.CHROME)
            .setChromeOptions(options)
            .build();
        return driver;
    });
}
function startScreenShare(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield driver.executeScript(`
window.navigator.mediaDevices.getDisplayMedia().then((stream) => {
  const videoEl = document.createElement("video");
  videoEl.srcObject = stream;
  videoEl.play();
  document.body.appendChild(videoEl);
});
`);
        console.log(response);
        driver.sleep(10000);
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const driver = yield getDriver();
        yield meetingbot(driver);
        // wait until admin lets u join
        yield startScreenShare(driver);
    });
}
main();
