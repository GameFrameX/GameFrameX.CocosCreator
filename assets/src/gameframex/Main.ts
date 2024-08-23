import { _decorator, Component, input, Input, Node, systemEvent } from 'cc';
import nettest from './nettest';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    start() {
        console.log('Press a key');
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    onKeyDown(event) {
        console.log('Press a key');
        switch (event.keyCode) {
            case cc.macro.KEY.a:
                // 执行相应的操作
                console.log("按下了A键");
                nettest.A();
                break;
            case cc.macro.KEY.s:
                // 执行相应的操作
                console.log("按下了A键");
                nettest.S();
                break;
            case cc.macro.KEY.d:
                // 执行相应的操作
                console.log("按下了A键");
                nettest.D();
                break;
            case cc.macro.KEY.f:
                // 执行相应的操作
                console.log("按下了A键");
                nettest.F();
                break;
        }
    }

    /*     update(deltaTime: number) {
    
           Input.EventType.KEY_DOWN
                // 判断按下的键值
                if (e.keyCode === Laya.Keyboard.A) {
                 
                } else if (e.keyCode === Laya.Keyboard.S) {
                    // 执行相应的操作
                    console.log("按下了S键");
                    nettest.S();
                } else if (e.keyCode === Laya.Keyboard.D) {
                    // 执行相应的操作
                    console.log("按下了D键");
                    nettest.D();
                } else if (e.keyCode === Laya.Keyboard.F) {
                    // 执行相应的操作
                    console.log("按下了F键");
                    nettest.F();
                }
            
        } */
}


