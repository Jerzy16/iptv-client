// remote-control.js
import { moveFocus } from './focus-manager.js';
import { navigate } from './router.js';

const KEY = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
  BACK_TIZEN: 10009, BACK_WEBOS: 461
};

export function initRemoteControl() {
  document.addEventListener('keydown', (e) => {
    switch (e.keyCode) {
      case KEY.LEFT:  moveFocus('left'); break;
      case KEY.UP:    moveFocus('up'); break;
      case KEY.RIGHT: moveFocus('right'); break;
      case KEY.DOWN:  moveFocus('down'); break;
      case KEY.ENTER: document.activeElement?.click(); break;
      case KEY.BACK_TIZEN:
      case KEY.BACK_WEBOS:
        history.back();
        break;
    }
  });
}