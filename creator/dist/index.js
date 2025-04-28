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
exports.CHROME_CONSTANTS = void 0;
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
        options.addArguments("--enable-usermedia-screen-capturing");
        options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
        options.addArguments("--auto-select-desktop-capture-source=[RECORD]");
        options.addArguments("--use-fake-ui-for-media-stream");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--window-size=1080,720");
        let driver = yield new selenium_webdriver_1.Builder()
            .forBrowser(selenium_webdriver_1.Browser.CHROME)
            .setChromeOptions(options)
            .build();
        return driver;
    });
}
exports.CHROME_CONSTANTS = {
    CHROME_OPTIONS1: [
        "----user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "--disable-blink-features=AutomationControlled",
        "--use-fake-ui-for-media-stream",
        "--window-size=1920,1080",
        "--disable-notifications",
        "--auto-select-desktop-capture-source=[RECORD]",
        "--enable-usermedia-screen-capturing",
        "--allow-running-insecure-content",
        "--safebrowsing-disable-download-protection",
        "--disable-download-notification",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-software-rasterizer",
        "--remote-debugging-port=9222",
        "--headless",
    ],
    CHROME_OPTIONS: [
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        "--disable-blink-features=AutomationControlled",
        "--use-fake-ui-for-media-stream",
        "--window-size=1920,1080",
        "--disable-notifications",
        "--auto-select-desktop-capture-source=[RECORD]",
        "--enable-usermedia-screen-capturing",
        "--allow-running-insecure-content",
        "--safebrowsing-disable-download-protection",
        "--disable-download-notification",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-software-rasterizer",
        "--remote-debugging-port=9222",
        // "--headless",
        "--force-device-scale-factor=1",
        "--high-dpi-support=1",
        "--disable-low-res-tiling",
        "--enable-font-antialiasing",
        "--enable-smooth-scrolling",
        "--disable-pinch",
        "--no-first-run",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
    ],
    MEDIA_STREAM_OPTIONS: {
        video: {
            displaySurface: "browser",
        },
        systemAudio: "include",
        audio: false,
        preferCurrentTab: true,
    },
};
function startScreenShare(driver) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield driver.executeScript(`
   (async () => {
        const mediaStreamOptions = ${JSON.stringify(exports.CHROME_CONSTANTS.MEDIA_STREAM_OPTIONS)};
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

        // Store recording data in array instead of sending via WebSocket
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
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const driver = yield getDriver();
        yield meetingbot(driver);
        driver.sleep(10000);
        // wait until admin lets u join
        yield startScreenShare(driver);
        driver.sleep(10000);
    });
}
main();
