// motion.js - iOS DeviceOrientation を Three.js のカメラ回転に変換
// iOS 13+ では requestPermission() が必要。

import * as THREE from 'three';

export class MotionController {
  constructor() {
    this.enabled = false;
    this.quaternion = new THREE.Quaternion();
    this.alpha = 0; this.beta = 0; this.gamma = 0;
    this.orient = 0;
    this._onOrient = this._onOrient.bind(this);
    this._onScreen = this._onScreen.bind(this);
  }

  static isPermissionRequired() {
    return typeof DeviceMotionEvent !== 'undefined'
      && typeof DeviceMotionEvent.requestPermission === 'function';
  }

  async requestPermission() {
    if (MotionController.isPermissionRequired()) {
      try {
        const r1 = await DeviceMotionEvent.requestPermission();
        let r2 = 'granted';
        if (typeof DeviceOrientationEvent !== 'undefined'
          && typeof DeviceOrientationEvent.requestPermission === 'function') {
          r2 = await DeviceOrientationEvent.requestPermission();
        }
        return r1 === 'granted' && r2 === 'granted';
      } catch (e) {
        console.warn('Motion permission error', e);
        return false;
      }
    }
    return true;
  }

  start() {
    window.addEventListener('deviceorientation', this._onOrient, true);
    window.addEventListener('orientationchange', this._onScreen, false);
    this._onScreen();
    this.enabled = true;
  }

  stop() {
    window.removeEventListener('deviceorientation', this._onOrient, true);
    window.removeEventListener('orientationchange', this._onScreen, false);
    this.enabled = false;
  }

  _onScreen() {
    this.orient = (window.orientation || 0);
  }

  _onOrient(e) {
    this.alpha = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
    this.beta  = e.beta  ? THREE.MathUtils.degToRad(e.beta)  : 0;
    this.gamma = e.gamma ? THREE.MathUtils.degToRad(e.gamma) : 0;
    const orient = THREE.MathUtils.degToRad(this.orient);
    this._setFromEuler(this.alpha, this.beta, this.gamma, orient);
  }

  // three.jsの公式 DeviceOrientationControls 相当の変換
  _setFromEuler(alpha, beta, gamma, orient) {
    const zee = new THREE.Vector3(0, 0, 1);
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around x
    const euler = new THREE.Euler();
    euler.set(beta, alpha, -gamma, 'YXZ');
    this.quaternion.setFromEuler(euler);
    this.quaternion.multiply(q1);
    this.quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
  }

  getQuaternion() {
    return this.quaternion;
  }
}
