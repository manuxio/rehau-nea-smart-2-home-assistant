import enhancedLogger, { StatusEmoji } from './enhanced-logger';

export interface CommandTracking {
  id: string;
  timestamp: number;
  zone: string;
  zoneId: string;
  type: 'temperature' | 'mode' | 'preset' | 'ring_light' | 'lock';
  oldValue: any;
  newValue: any;
  isNoOp: boolean;
  status: 'pending' | 'confirmed' | 'timeout' | 'rejected' | 'no-change';
  confirmationTime?: number;
}

class CommandTracker {
  private commands: Map<string, CommandTracking> = new Map();
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  trackCommand(
    zoneId: string,
    zoneName: string,
    type: CommandTracking['type'],
    oldValue: any,
    newValue: any
  ): string {
    const id = `${zoneId}_${type}_${Date.now()}`;
    const isNoOp = this.isNoOpCommand(oldValue, newValue);

    const tracking: CommandTracking = {
      id,
      timestamp: Date.now(),
      zone: zoneName,
      zoneId,
      type,
      oldValue,
      newValue,
      isNoOp,
      status: 'pending'
    };

    this.commands.set(id, tracking);

    // Log the command
    if (isNoOp) {
      enhancedLogger.warn(
        `Command has zero effect, REHAU may silently discard: ${zoneName} ${type} ${oldValue} → ${newValue}`,
        {
          component: 'BRIDGE',
          direction: 'INTERNAL',
          zoneName,
          operation: 'command_tracking'
        }
      );
    } else {
      enhancedLogger.info(
        `${StatusEmoji.PROGRESS} Tracking command: ${zoneName} ${type} ${oldValue} → ${newValue}`,
        {
          component: 'BRIDGE',
          direction: 'INTERNAL',
          zoneName,
          operation: 'command_tracking'
        }
      );
    }

    // Set timeout for command
    setTimeout(() => {
      this.checkCommandTimeout(id);
    }, this.TIMEOUT_MS);

    return id;
  }

  confirmCommand(commandId: string): void {
    const command = this.commands.get(commandId);
    if (!command) return;

    command.status = 'confirmed';
    command.confirmationTime = Date.now() - command.timestamp;

    enhancedLogger.info(
      `${StatusEmoji.SUCCESS} Command confirmed: ${command.zone} ${command.type}`,
      {
        component: 'REHAU',
        direction: 'INCOMING',
        zoneName: command.zone,
        operation: 'command_confirmed',
        duration: command.confirmationTime
      }
    );

    // Clean up after confirmation
    setTimeout(() => {
      this.commands.delete(commandId);
    }, 60000); // Keep for 1 minute for debugging
  }

  rejectCommand(commandId: string, reason: string): void {
    const command = this.commands.get(commandId);
    if (!command) return;

    command.status = 'rejected';

    enhancedLogger.error(
      `${StatusEmoji.FAILURE} Command rejected: ${command.zone} ${command.type} - ${reason}`,
      undefined,
      {
        component: 'REHAU',
        direction: 'INCOMING',
        zoneName: command.zone,
        operation: 'command_rejected'
      }
    );
  }

  private checkCommandTimeout(commandId: string): void {
    const command = this.commands.get(commandId);
    if (!command || command.status !== 'pending') return;

    if (command.isNoOp) {
      command.status = 'no-change';
      enhancedLogger.warn(
        `${StatusEmoji.WARNING} No response after ${this.TIMEOUT_MS / 1000}s, command likely discarded (zero effect): ${command.zone} ${command.type}`,
        {
          component: 'REHAU',
          direction: 'INCOMING',
          zoneName: command.zone,
          operation: 'command_timeout'
        }
      );
    } else {
      command.status = 'timeout';
      enhancedLogger.error(
        `${StatusEmoji.FAILURE} Command timeout after ${this.TIMEOUT_MS / 1000}s: ${command.zone} ${command.type}`,
        undefined,
        {
          component: 'REHAU',
          direction: 'INCOMING',
          zoneName: command.zone,
          operation: 'command_timeout'
        }
      );
    }
  }

  private isNoOpCommand(oldValue: any, newValue: any): boolean {
    // For numbers, check if they're close enough (within 0.1)
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      return Math.abs(oldValue - newValue) < 0.1;
    }
    
    // For other types, strict equality
    return oldValue === newValue;
  }

  getCommandStatus(commandId: string): CommandTracking | undefined {
    return this.commands.get(commandId);
  }

  getPendingCommands(): CommandTracking[] {
    return Array.from(this.commands.values()).filter(cmd => cmd.status === 'pending');
  }

  getCommandStats(): {
    total: number;
    pending: number;
    confirmed: number;
    timeout: number;
    rejected: number;
    noChange: number;
  } {
    const commands = Array.from(this.commands.values());
    return {
      total: commands.length,
      pending: commands.filter(c => c.status === 'pending').length,
      confirmed: commands.filter(c => c.status === 'confirmed').length,
      timeout: commands.filter(c => c.status === 'timeout').length,
      rejected: commands.filter(c => c.status === 'rejected').length,
      noChange: commands.filter(c => c.status === 'no-change').length
    };
  }
}

export const commandTracker = new CommandTracker();
export default commandTracker;
