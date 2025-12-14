//////////////////////
//##################//
//##              ##//
//##  eserial.ts  ##//
//##              ##//
//##################//
//////////////////////

namespace ESerial {

    let g_init = false
    let g_read: string[]
    let g_write: string[]
    g_read = []
    g_write = []
    let g_read_tmo = 0
    let g_write_tmo = 0

    let g_tx_dat: DigitalPin	// tx out data
    let g_tx_rdy: DigitalPin	// tx out data valid
    let g_tx_rcv: DigitalPin	// tx in  data received
    let g_rx_dat: DigitalPin	// rx in  data
    let g_rx_rdy: DigitalPin	// rx in  data valid
    let g_rx_rcv: DigitalPin	// rx out data received

    function initESerial() {
        pins.digitalWritePin(g_tx_dat, 0)
        pins.digitalWritePin(g_tx_rdy, 0)
        pins.digitalReadPin(g_tx_rcv)
        pins.digitalReadPin(g_rx_dat)
        pins.digitalReadPin(g_rx_rdy)
        pins.digitalWritePin(g_rx_rcv, 0)
        g_read = []
        g_write = []
    }

    function writeChar(char: string) {
        let ch = char.charCodeAt(0)
        let pin: number
        for (let i = 0; i < 8; i++) {
            pin = (ch & (1 << i))
            pins.digitalWritePin(g_tx_dat, pin == 0 ? 0 : 1)
            pins.digitalWritePin(g_tx_rdy, 1)
            while (!pins.digitalReadPin(g_tx_rcv)) {
                if (control.millis() > g_write_tmo) { initESerial(); return; }
            }
            pins.digitalWritePin(g_tx_rdy, 0)
            while (pins.digitalReadPin(g_tx_rcv)) {
                if (control.millis() > g_write_tmo) { initESerial(); return; }
            }
        }
    }

    function readChar(): string {
        let pin: number
        let ch = 0
        for (let i = 0; i < 8; i++) {
            while (!pins.digitalReadPin(g_rx_rdy)) {
                if (control.millis() > g_read_tmo) { initESerial(); return ""; }
            }
            pin = pins.digitalReadPin(g_rx_dat)
            ch |= (pin << i)
            pins.digitalWritePin(g_rx_rcv, 1)
            while (pins.digitalReadPin(g_rx_rdy)) {
                if (control.millis() > g_read_tmo) { initESerial(); return ""; }
            }
            pins.digitalWritePin(g_rx_rcv, 0)
        }
        let ret = (ch == 0 ? "" : String.fromCharCode(ch))
        return ret
    }

    // write strings
    basic.forever(function () {
        if (!g_init) return;
        if (g_write.length > 0) {
            g_write_tmo = control.millis() + 5000
            let str = g_write.shift()
            for (let i = 0; i < str.length; i++) {
                if (control.millis() > g_write_tmo) { initESerial(); break; }
                writeChar(str[i])
            }
            writeChar(String.fromCharCode(0))
        }
    })

    // read strings
    basic.forever(function () {
        if (!g_init) return;
        let str = ""
        let ch = ""
        if ((pins.digitalReadPin(g_rx_rdy) == 1)) { // available
            g_read_tmo = control.millis() + 5000
            do {
                ch = readChar()
                str += ch
            } while (!ch.isEmpty())
            if (control.millis() <= g_read_tmo)
                g_read.push(str)
            str = ""
        }
    })

    export function setPins(tx_dat: DigitalPin,
        tx_rdy: DigitalPin,
        tx_rcv: DigitalPin,
        rx_dat: DigitalPin,
        rx_rdy: DigitalPin,
        rx_rcv: DigitalPin) {
        g_tx_dat = tx_dat
        g_tx_rdy = tx_rdy
        g_tx_rcv = tx_rcv
        g_rx_dat = rx_dat
        g_rx_rdy = rx_rdy
        g_rx_rcv = rx_rcv

        initESerial()
        g_init = true
    }

    export function available(): boolean {
        return (g_read.length > 0)
    }

    export function write(str: string) {
        g_write.push(str)
    }

    export function read(): string {
        if (g_read.length)
            return g_read.shift()
        return ""
    }
}

///////////////////////
//###################//
//##               ##//
//##  rpimedia.ts  ##//
//##               ##//
//###################//
///////////////////////

let mediaHandler: handler

basic.showIcon(IconNames.Heart)
ESerial.setPins(
    DigitalPin.P0,     // tx-dat >> rx-dat RPI GPIO 10
    DigitalPin.P1,     // tx-rdy >> rx-rdy RPI GPIO 9
    DigitalPin.P2,     // tx-rcv >> rx-rcv RPI GPIO 11
    DigitalPin.P14,    // rx-dat >> tx-dat RPI GPIO 5
    DigitalPin.P15,    // rx-rdy >> tx-rdy RPI GPIO 6
    DigitalPin.P16     // rx-rcv >> tx-rcv RPI GPIO 13
)
basic.showIcon(IconNames.Yes)

let READY = false
let RPIMSG = ""
let RPIVAL = ""
let RPITIM = 0.0

basic.forever(function () {
    if (ESerial.available()) {
        READY = true
        RPIMSG = ESerial.read()
        if (RPIMSG == "RDY")
            READY = true
        else {
            RPIVAL = ""
            RPITIM = 0
            let ix = RPIMSG.indexOf("|")
            if (ix >= 0) {
                RPIVAL = RPIMSG.substr(ix + 1)
                RPIMSG = RPIMSG.substr(0, ix)
                ix = RPIVAL.indexOf("|")
                if (ix >= 0) {
                    RPITIM = parseFloat( RPIVAL.substr(ix + 1))
                    RPIVAL = RPIVAL.substr(0, ix)
                }
            }
            if (mediaHandler)
                mediaHandler()
        }
    }
})

//% color="#FF2266" icon="\uf144"
//% block="RPi Media"
//% block.loc.nl="RPi Media"
namespace RPiMedia {

    //% color="#FFC000"
    //% block="execute commands"
    //% block.loc.nl="verwerk de instructies"
    export function onCommand(code: () => void): void {
        mediaHandler = code
    }

    //% block="duration"
    //% block.loc.nl="tijdsduur"
    export function duration(): number {
        return RPITIM
    }

    //% block="value"
    //% block.loc.nl="waarde"
    export function value(): string {
        return RPIMSG
    }

    //% block="command"
    //% block.loc.nl="instructie"
    export function command(): string {
        return RPIMSG
    }

    //% block="stop"
    //% block.loc.nl="stop"
    export function stop() {
        ESerial.write("stop")
        READY = true
    }

    //% block="show the standby screen"
    //% block.loc.nl="toon het standby-scherm"
    export function showStandby() {
        ESerial.write("standby")
        READY = true
    }

    //% block="show image %name for %time sec."
    //% block.loc.nl="toon afbeelding %name voor %time sec."
    export function showImage(name: string, time: number) {
        let msg = name + "|" + time.toString()
        ESerial.write(msg)
        READY = false
        while (!READY) basic.pause(1)
    }

    //% block="show video %name"
    //% block.loc.nl="toon video %name"
    export function showVideo(name: string) {
        ESerial.write(name)
        READY = false
        while (!READY) basic.pause(1)
    }
}
