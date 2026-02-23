/**
 * HA Status Publisher - Publish system status sensors to Home Assistant
 */

import logger from '../logger';
import type RehauMQTTBridge from '../mqtt-bridge';

export type BridgeStatus = 'connected' | 'authenticating' | 'error' | 'degraded';
export type AuthStatus = 'authenticated' | 'expired' | 'refreshing' | 'failed';
export type MQTTQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

export class StatusPublisher {
  private mqttBridge: RehauMQTTBridge;
  private bridgeStatus: BridgeStatus = 'authenticating';
  private authStatus: AuthStatus = 'authenticated';
  private mqttQuality: MQTTQuality = 'disconnected';
  private sessionStartTime: number = Date.now();
  private publishInterval: NodeJS.Timeout | null = null;

  constructor(mqttBridge: RehauMQTTBridge) {
    this.mqttBridge = mqttBridge;
  }

  /**
   * Initialize status sensors in Home Assistant
   */
  async initialize(): Promise<void> {
    logger.info('📊 Initializing HA status sensors...');

    // Publish discovery configs
    await this.publishBridgeStatusConfig();
    await this.publishAuthStatusConfig();
    await this.publishMQTTQualityConfig();
    await this.publishSessionAgeConfig();

    // Publish initial states
    await this.publishAllStates();

    // Start periodic updates (every 30 seconds)
    this.publishInterval = setInterval(() => {
      this.publishAllStates();
    }, 30000);

    logger.info('✅ HA status sensors initialized');
  }

  /**
   * Update bridge status
   */
  setBridgeStatus(status: BridgeStatus): void {
    if (this.bridgeStatus !== status) {
      this.bridgeStatus = status;
      logger.info(`📊 Bridge status: ${status}`);
      this.publishBridgeStatus();
    }
  }

  /**
   * Update auth status
   */
  setAuthStatus(status: AuthStatus): void {
    if (this.authStatus !== status) {
      this.authStatus = status;
      logger.info(`🔐 Auth status: ${status}`);
      this.publishAuthStatus();
    }
  }

  /**
   * Update MQTT quality
   */
  setMQTTQuality(quality: MQTTQuality): void {
    if (this.mqttQuality !== quality) {
      this.mqttQuality = quality;
      logger.info(`📡 MQTT quality: ${quality}`);
      this.publishMQTTQuality();
    }
  }

  /**
   * Publish bridge status sensor config
   */
  private async publishBridgeStatusConfig(): Promise<void> {
    const config = {
      name: 'REHAU Bridge Status',
      unique_id: 'rehau_bridge_status',
      state_topic: 'homeassistant/sensor/rehau_bridge_status/state',
      icon: 'mdi:bridge',
      device: {
        identifiers: ['rehau_bridge'],
        name: 'REHAU NEA SMART Bridge',
        manufacturer: 'REHAU',
        model: 'MQTT Bridge',
        sw_version: process.env.npm_package_version || '5.0.0'
      }
    };

    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_bridge_status/config',
      config,
      { retain: true }
    );
  }

  /**
   * Publish auth status sensor config
   */
  private async publishAuthStatusConfig(): Promise<void> {
    const config = {
      name: 'REHAU Auth Status',
      unique_id: 'rehau_auth_status',
      state_topic: 'homeassistant/sensor/rehau_auth_status/state',
      icon: 'mdi:shield-key',
      device: {
        identifiers: ['rehau_bridge'],
        name: 'REHAU NEA SMART Bridge',
        manufacturer: 'REHAU',
        model: 'MQTT Bridge',
        sw_version: process.env.npm_package_version || '5.0.0'
      }
    };

    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_auth_status/config',
      config,
      { retain: true }
    );
  }

  /**
   * Publish MQTT quality sensor config
   */
  private async publishMQTTQualityConfig(): Promise<void> {
    const config = {
      name: 'REHAU MQTT Quality',
      unique_id: 'rehau_mqtt_quality',
      state_topic: 'homeassistant/sensor/rehau_mqtt_quality/state',
      icon: 'mdi:wifi',
      device: {
        identifiers: ['rehau_bridge'],
        name: 'REHAU NEA SMART Bridge',
        manufacturer: 'REHAU',
        model: 'MQTT Bridge',
        sw_version: process.env.npm_package_version || '5.0.0'
      }
    };

    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_mqtt_quality/config',
      config,
      { retain: true }
    );
  }

  /**
   * Publish session age sensor config
   */
  private async publishSessionAgeConfig(): Promise<void> {
    const config = {
      name: 'REHAU Session Age',
      unique_id: 'rehau_session_age',
      state_topic: 'homeassistant/sensor/rehau_session_age/state',
      unit_of_measurement: 's',
      icon: 'mdi:clock-outline',
      device: {
        identifiers: ['rehau_bridge'],
        name: 'REHAU NEA SMART Bridge',
        manufacturer: 'REHAU',
        model: 'MQTT Bridge',
        sw_version: process.env.npm_package_version || '5.0.0'
      }
    };

    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_session_age/config',
      config,
      { retain: true }
    );
  }

  /**
   * Publish all status states
   */
  private async publishAllStates(): Promise<void> {
    await this.publishBridgeStatus();
    await this.publishAuthStatus();
    await this.publishMQTTQuality();
    await this.publishSessionAge();
  }

  /**
   * Publish bridge status state
   */
  private async publishBridgeStatus(): Promise<void> {
    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_bridge_status/state',
      this.bridgeStatus,
      { retain: true }
    );
  }

  /**
   * Publish auth status state
   */
  private async publishAuthStatus(): Promise<void> {
    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_auth_status/state',
      this.authStatus,
      { retain: true }
    );
  }

  /**
   * Publish MQTT quality state
   */
  private async publishMQTTQuality(): Promise<void> {
    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_mqtt_quality/state',
      this.mqttQuality,
      { retain: true }
    );
  }

  /**
   * Publish session age state
   */
  private async publishSessionAge(): Promise<void> {
    const sessionAge = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    this.mqttBridge.publishToHomeAssistant(
      'homeassistant/sensor/rehau_session_age/state',
      sessionAge.toString(),
      { retain: true }
    );
  }

  /**
   * Reset session start time (call after successful auth)
   */
  resetSessionAge(): void {
    this.sessionStartTime = Date.now();
    this.publishSessionAge();
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
  }
}

export default StatusPublisher;
