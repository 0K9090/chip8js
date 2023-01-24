var canvas = document.getElementById("canvas");
var context = canvas.getContext("2d");
var rom = [];
var memory = new Uint8Array(4096);
var registerV = new Uint8Array(16);
var stack = new Uint16Array(16);
var pc = 0x200;
var ppc = pc;
var sp = 0;
var index = 0x0;
var screenPixels = Array(64 * 32).fill(0);
var delay_timer = 0;
var sound_timer = 0;
var opcode = 0x0;
var ttr = 0x0;
var loaded = false;
var pause;
var fxoapress;
var fxoaindex;
var keysPressed = Array(16).fill(0);
var fontset = [
  0xf0,
  0x90,
  0x90,
  0x90,
  0xf0, // 0
  0x20,
  0x60,
  0x20,
  0x20,
  0x70, // 1
  0xf0,
  0x10,
  0xf0,
  0x80,
  0xf0, // 2
  0xf0,
  0x10,
  0xf0,
  0x10,
  0xf0, // 3
  0x90,
  0x90,
  0xf0,
  0x10,
  0x10, // 4
  0xf0,
  0x80,
  0xf0,
  0x10,
  0xf0, // 5
  0xf0,
  0x80,
  0xf0,
  0x90,
  0xf0, // 6
  0xf0,
  0x10,
  0x20,
  0x40,
  0x40, // 7
  0xf0,
  0x90,
  0xf0,
  0x90,
  0xf0, // 8
  0xf0,
  0x90,
  0xf0,
  0x10,
  0xf0, // 9
  0xf0,
  0x90,
  0xf0,
  0x90,
  0x90, // A
  0xe0,
  0x90,
  0xe0,
  0x90,
  0xe0, // B
  0xf0,
  0x80,
  0x80,
  0x80,
  0xf0, // C
  0xe0,
  0x90,
  0x90,
  0x90,
  0xe0, // D
  0xf0,
  0x80,
  0xf0,
  0x80,
  0xf0, // E
  0xf0,
  0x80,
  0xf0,
  0x80,
  0x80, // F
];

function loadRom(event) {
  const file = event.target.files[0];
  let reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(reader.result);
    let romSize = data.length;
    for (let i = 0; i < romSize; i++) {
      memory[0x200 + i] = data[i];
    }
  };
  reader.readAsArrayBuffer(file);
}

function drawScreen() {
  context.fillStyle = "black";
  context.font = "70px Arial";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "white";
  let currentPixel = -1;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      currentPixel++;
      if (screenPixels[currentPixel] != 0) {
        context.fillRect(x * 10, y * 10, 10, 10);
      }
    }
  }
}

function emulationCycle() {
  // This is the main emulation cycle, where all the opcodes get run.
  // I have not implemented the keypad yet.
  let Vx = 0x0;
  let Vy = 0x0;
  let VF = 0x0;
  let nn = 0x0;
  for (let opcodesExe = 0; opcodesExe < 8; opcodesExe++) {
    ppc = pc;
    opcode = (memory[pc] << 8) | memory[pc + 1];
    pc += 2;
    document.getElementById("opcode").innerHTML =
      "Opcode:" + (opcode & 0xffff).toString(16);
    switch ((opcode & 0xf000) >> 12) {
      case 0x0:
        switch (opcode & 0x000f) {
          case 0xe:
            // OPCODE: 0x00EE
            // Function: Return from a sub-routine.
            ttr = "0x00EE";
            sp--;
            pc = stack[sp];
            break;
          default:
            // OPCODE: 0x000E
            // FUNCTION: Clears the screen.
            ttr = "0x000E";
            screenPixels = Array(64 * 32).fill(0);
            break;
        }
        break;
      case 0x1:
        // OPCODE: 0x1nnn
        // FUNCTION: Set program counter to nnn.
        ttr = "0x1nnn";
        pc = opcode & 0x0fff;
        break;
      case 0x2:
        // OPCODE: 0x2nnn
        // FUNCTION: Call a subroutine at nnn.
        ttr = "0x2nnn";
        stack[sp] = pc;
        sp++;
        pc = opcode & 0x0fff;
        break;
      case 0x3:
        // OPCODE: 0x3xnn
        // FUNCTION: if Vx == nn: Increment program counter by 2.
        ttr = "0x3xnn";
        Vx = registerV[(opcode & 0x0f00) >> 8];
        nn = opcode & 0x00ff;
        if (Vx == nn) {
          pc += 2;
        }
        break;
      case 0x4:
        // OPCODE: 0x4xnn
        // FUNCTION: if Vx != nn: Increment program counter by 2.
        ttr = "0x4xnn";
        Vx = registerV[(opcode & 0x0f00) >> 8];
        nn = opcode & 0x00ff;
        if (Vx != nn) {
          pc += 2;
        }
        break;
      case 0x5:
        // OPCODE: 0x5xy0
        // FUNCTION: if Vx == Vy: Increment program counter by 2.
        ttr = "0x5xy0";
        Vx = registerV[(opcode & 0x0f00) >> 8];
        Vy = registerV[(opcode & 0x00f0) >> 4];
        if (Vx == Vy) {
          pc += 2;
        }
        break;
      case 0x6:
        // OPCODE: 0x6xnn
        // FUNCTION: Set Vx to nn.
        ttr = "0x6xnn";
        registerV[(opcode & 0x0f00) >> 8] = opcode & 0x00ff;
        break;
      case 0x7:
        // OPCODE: 0x7xnn
        // FUNCTION: Add nn to Vx, then set Vx to the sum.
        ttr = "0x7xnn";
        registerV[(opcode & 0x0f00) >> 8] =
          (registerV[(opcode & 0x0f00) >> 8] + (opcode & 0x00ff)) & 0xff;
        break;
      case 0x8:
        switch (opcode & 0x000f) {
          case 0x0:
            // OPCODE: 0x8xy0
            // FUNCTION: Set Vx to Vy.
            ttr = "0x8xy0";
            registerV[(opcode & 0x0f00) >> 8] =
              registerV[(opcode & 0x00f0) >> 4];
            break;
          case 0x1:
            // OPCODE: 0x8xy1
            // FUNCTION: Perform bitwise OR operation on Vx and Vy, then set Vx to the output.
            ttr = "0x8xy1";
            registerV[(opcode & 0x0f00) >> 8] |=
              registerV[(opcode & 0x00f0) >> 4];
            registerV[0xf] = 0;
            break;
          case 0x2:
            // OPCODE: 0x8xy2
            // FUNCTION: Perform a bitwise AND operation on Vx and Vy, then set Vx to the output.
            ttr = "0x8xy2";
            registerV[(opcode & 0x0f00) >> 8] &=
              registerV[(opcode & 0x00f0) >> 4];
            registerV[0xf] = 0;
            break;
          case 0x3:
            // OPCODE: 0x8xy3
            // FUNCTION: Perform a bitwise XOR operation on Vx and Vy, then set Vx to the output.
            ttr = "0x8xy3";
            registerV[(opcode & 0x0f00) >> 8] ^=
              registerV[(opcode & 0x00f0) >> 4];
            registerV[0xf] = 0;
            break;
          case 0x4:
            // OPCODE: 0x8xy4
            // FUNCTION: Add Vy to Vx, but if the result is greater than 255 (8 bits) then set VF to 1. Else 0.
            ttr = "0x8xy4";
            added =
              registerV[(opcode & 0x0f00) >> 8] +
              registerV[(opcode & 0x00f0) >> 4];
            if (added > 255) {
              registerV[0xf] = 1;
            } else {
              registerV[0xf] = 0;
            }
            registerV[(opcode & 0x0f00) >> 8] = added & 0xff;
            break;
          case 0x5:
            // OPCODE: 0x8xy5
            // FUNCTION: If Vx > Vy, then set VF to 1. Else 0. Then subtract Vy from Vx then set Vx to that.
            ttr = "0x8xy5";
            registerV[(opcode & 0x0f00) >> 8] =
              (registerV[(opcode & 0x0f00) >> 8] -
                registerV[(opcode & 0x00f0) >> 4]) &
              0xff;
            if (
              registerV[(opcode & 0x0f00) >> 8] >
              registerV[(opcode & 0x00f0) >> 4]
            ) {
              registerV[0xf] = 1;
            } else {
              registerV[0xf] = 0;
            }
            break;
          case 0x6:
            // OPCODE: 0x8xy6
            // FUNCTION: If least significant bit of Vx is 1, then set  VF to 1. Else 0. Then divide Vx by 2.
            ttr = "0x8xy6";
            VF = registerV[(opcode & 0x0f00) >> 8] & 0x1;
            registerV[(opcode & 0x0f00) >> 8] >>= 1;
            registerV[0xf] = VF;
            break;
          case 0x7:
            // OPCODE: 0x8xy7
            // FUNCTION: If Vy > Vx, then set VF to 1. Else 0. Then subtract Vx from Vy then set Vx to that.
            ttr = "0x8xy7";
            registerV[(opcode & 0x0f00) >> 8] =
              (registerV[(opcode & 0x00f0) >> 4] -
                registerV[(opcode & 0x0f00) >> 8]) &
              0xff;
            if (
              registerV[(opcode & 0x00f0) >> 4] >
              registerV[(opcode & 0x0f00) >> 8]
            ) {
              registerV[0xf] = 1;
            } else {
              registerV[0xf] = 0;
            }
            break;
          case 0xe:
            // OPCODE: 0x8xyE
            // FUNCTION: If most significant bit of Vx is 1, then set  VF to 1. Else 0. Then multiply Vx by 2.
            ttr = "0x8xyE";
            VF = (registerV[(opcode & 0x0f00) >> 8] & 0x80) >> 7;
            registerV[(opcode & 0x0f00) >> 8] =
              (registerV[(opcode & 0x0f00) >> 8] << 1) & 0x0ff;
            registerV[0xf] = VF;
            break;
        }
        break;
      case 0x9:
        // OPCODE: 0x9xy0
        // FUNCTION: Increment the program counter by 2 if Vx != Vy.
        ttr = "0x8xy0";
        Vx = registerV[(opcode & 0x0f00) >> 8];
        Vy = registerV[(opcode & 0x00f0) >> 4];
        if (Vx != Vy) {
          pc += 2;
        }
        break;
      case 0xa:
        // OPCODE: 0xAnnn
        // FUNCTION: Set index to nnn.
        ttr = "0xAnnn";
        index = opcode & 0x0fff;
        break;
      case 0xb:
        // OPCODE: 0xBnnn
        // FUNCTION: Jump to location nnn + V0
        ttr = "0xBnnn";
        pc = (opcode & 0x0fff) + registerV[(opcode & 0x0f00) >> 8];
        break;
      case 0xc:
        // OPCODE: 0xCxnn
        // FUNCTION: The interpreter generates a random number from 0 to 255, which is then ANDed with the value nn.The results are stored in Vx.
        ttr = "0xCxnn";
        randByte = Math.Floor(Math.random() * (256 - 0) + 0);
        registerV[(opcode & 0x0f00) >> 8] = randByte & (opcode & 0x00ff);
        break;
      case 0xd:
        // OPCODE: 0xDxyn
        // FUNCTION: Display n - byte sprite starting at memory location I at(Vx, Vy), set VF = collision.
        ttr = "0xDxyn";
        if (opcodesExe == 0) {
          x = registerV[(opcode & 0x0f00) >> 8] % 64;
          y = registerV[(opcode & 0x00f0) >> 4] % 32;
          registerV[0xf] = 0;
          for (let row = 0; row < (opcode & 0x000f); row++) {
            let sByte = memory[index + row];
            for (let col = 0; col < 8; col++) {
              if ((sByte & (0x80 >> col)) != 0) {
                if (screenPixels[x + col + (y + row) * 64] == 1) {
                  registerV[0xf] = 1;
                }
                screenPixels[x + col + (y + row) * 64] ^= 1;
              }
            }
          }
        } else {
          pc -= 2;
        }
        break;
      case 0xe:
        switch (opcode & 0x000f) {
          case 0xe:
            // OPCODE: 0xEx9E
            // FUNCTION: Increment the program counter by 2 if the key with the value of Vx is pressed.
            ttr = "0xEx9E";
            if (keysPressed[registerV[(opcode & 0x0f00) >> 8]] != 0) {
              pc += 2;
            }
            break;
          default:
            // OPCODE: 0xExA1
            // FUNCTION: Incrememt the program counter by 2 if the key with the value of Vx is not currently pressed.
            ttr = "0xExA1";
            if (keysPressed[registerV[(opcode & 0x0f00) >> 8]] == 0) {
              pc += 2;
            }
            break;
        }
        break;
      case 0xf:
        switch (opcode & 0x000f) {
          case 0x7:
            // OPCODE: Fx07
            // FUNCTION: Set Vx to the value of the delay timer.
            ttr = "0xFx07";
            registerV[(opcode & 0x0f00) >> 8] = delay_timer;
            break;
          case 0xa:
            // OPCODE: Fx0A
            // FUNCTION: Wait until a key is pressed then store the value in Vx
            ttr = "0xFx0A";
            if (keysPressed.includes(1)) {
              fxoaindex = keysPressed.indexOf(1);
              fxoapress = true;
              pc -= 2;
            } else {
              if (fxoapress) {
                registerV[(opcode & 0x0f00) >> 8] = fxoaindex;
                fxoapress = false;
              } else {
                pc -= 2;
              }
              break;
            }
            break;
          case 0x5:
            switch ((opcode & 0x00f0) >> 4) {
              case 0x1:
                // OPCODE: 0xFx15
                // FUNCTION: Set the delay timer to Vx
                ttr = "0xFx15";
                delay_timer = registerV[(opcode & 0x0f00) >> 8];
                break;
              case 0x5:
                // OPCODE: 0xFx55
                // FUNCTION: Store registers V0 through Vx in memory starting at location index.
                ttr = "0xFx55";
                for (let i = 0; i < ((opcode & 0x0f00) >> 8) + 1; i++) {
                  memory[index + i] = registerV[i];
                }
                index++;
                break;
              default:
                // OPCODE: 0xFx65
                // FUNCTION: Read registers V0 through Vx from memory starting at location index.
                ttr = "0xFx65";
                for (let i = 0; i < ((opcode & 0x0f00) >> 8) + 1; i++) {
                  registerV[i] = memory[index + i];
                }
                index++;
                break;
            }
            break;
          case 0x8:
            // OPCODE: 0xFx18
            // FUNCTION: Set the sound timer to Vx
            ttr = "0xFx18";
            sound_timer = registerV[(opcode & 0x0f00) >> 8];
            break;
          case 0xe:
            // OPCODE: 0xFx1E
            // FUNCTION: Add I and Vx and store the result in I
            ttr = "0xFx1E";
            index += registerV[(opcode & 0x0f00) >> 8];
            break;
          case 0x9:
            // OPCODE: 0xFx29
            // FUNCTION: Set index to the location of sprite for digit Vx.
            ttr = "0xFx29";
            index = 0x50 + 5 * registerV[(opcode & 0x0f00) >> 8];
            break;
          case 0x3:
            // OPCODE: 0xFx33
            // FUNCTION: Store BCD representation of Vx in memory locations index, index + 1, and index + 2.
            ttr = "0xFx33";
            let value = registerV[(opcode & 0x0f00) >> 8];
            memory[index + 2] = value % 10;
            value /= 10;
            memory[index + 1] = value % 10;
            value /= 10;
            memory[index] = value % 10;
            break;
        }
        break;
    }
  }
  drawScreen();
  if (delay_timer > 0) {
    delay_timer--;
  }
  if (sound_timer > 0) {
    sound_timer--;
  }
  window.requestAnimationFrame(emulationCycle);
}

function gameloop(event) {
  loadRom(event);
  pause = false;
  fxoapress = false;
  fxoaindex = 0;
  for (let i = 0; i < 80; i++) {
    memory[0x50 + i] = fontset[i];
  }
  window.requestAnimationFrame(emulationCycle);
}

document
  .getElementById("file-input")
  .addEventListener("change", gameloop, false);
