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
const ws_1 = require("./ws");
function openMeet(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield driver.get("https://meet.google.com/uvu-juma-edu");
            const popupButton = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Got it")]')), 10000);
            yield popupButton.click();
            const nameInput = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//input[@placeholder="Your name"]')), 10000);
            yield nameInput.clear();
            yield nameInput.click();
            yield nameInput.sendKeys("value", "Meeting bot");
            yield driver.sleep(1000);
            const buttonInput = yield driver.wait(selenium_webdriver_1.until.elementLocated(selenium_webdriver_1.By.xpath('//span[contains(text(), "Ask to join")]')), 10000);
            buttonInput.click();
        }
        finally {
        }
    });
}
function getDriver() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = new chrome_1.Options({});
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--use-fake-ui-for-media-stream");
        options.addArguments("--window-size=1080,720");
        options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
        options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
        options.addArguments("--enable-usermedia-screen-capturing");
        options.addArguments('--auto-select-tab-capture-source-by-title="Meet"');
        options.addArguments("--allow-running-insecure-content");
        // ​​--allow-file-access-from-files--use-fake-device-for-media-stream--allow-running-insecure-content--allow-file-access-from-files--use-fake-device-for-media-stream--allow-running-insecure-content
        let driver = yield new selenium_webdriver_1.Builder()
            .forBrowser(selenium_webdriver_1.Browser.CHROME)
            .setChromeOptions(options)
            .build();
        return driver;
    });
}
function startScreenshare(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("startScreensharecalled");
        const response = yield driver.executeScript(`
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
        })();
    `);
        console.log(response);
        driver.sleep(1000000);
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        (0, ws_1.startWebSocketServer)(3001);
        const driver = yield getDriver();
        yield openMeet(driver);
        yield new Promise((x) => setTimeout(x, 20000));
        // wait until admin lets u join
        yield startScreenshare(driver);
    });
}
main();
