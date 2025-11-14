import cron from 'node-cron';
import config from '../config';
import logger from '../utils/logger';
import reconciliationService from '../services/reconciliation.service';

export class Scheduler {
  private tasks: cron.ScheduledTask[] = [];

  /**
   * Start all scheduled tasks
   */
  start(): void {
    logger.info('Starting scheduler...');

    // Schedule automatic reconciliation
    const reconciliationTask = cron.schedule(
      config.reconciliation.cronSchedule,
      async () => {
        logger.info('Running scheduled reconciliation...');
        try {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - config.reconciliation.lookbackDays);

          const runId = await reconciliationService.reconcile(startDate, endDate);
          logger.info(`Scheduled reconciliation completed: ${runId}`);
        } catch (error: any) {
          logger.error('Scheduled reconciliation failed:', error.message);
        }
      },
      {
        scheduled: false,
      }
    );

    this.tasks.push(reconciliationTask);
    reconciliationTask.start();

    logger.info(`Reconciliation scheduled with cron: ${config.reconciliation.cronSchedule}`);
    logger.info(`Looking back ${config.reconciliation.lookbackDays} days on each run`);
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    logger.info('Stopping scheduler...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    logger.info('Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): any {
    return {
      running: this.tasks.length > 0,
      tasksCount: this.tasks.length,
      schedule: config.reconciliation.cronSchedule,
      lookbackDays: config.reconciliation.lookbackDays,
    };
  }
}

export default new Scheduler();
