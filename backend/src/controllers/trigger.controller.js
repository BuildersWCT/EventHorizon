const Trigger = require('../models/trigger.model');
const TriggerVersion = require('../models/triggerVersion.model');
const logger = require('../config/logger');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

exports.createTrigger = asyncHandler(async (req, res) => {
    logger.info('Creating new trigger', {
        contractId: req.body.contractId,
        eventName: req.body.eventName,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });

    const trigger = new Trigger(req.body);
    await trigger.save();

    // Save initial version
    const version = new TriggerVersion({
        triggerId: trigger._id,
        version: 1,
        snapshot: trigger.toObject(),
        changeType: 'config',
        changedBy: req.user ? req.user._id : 'system',
        changeDescription: 'Initial creation'
    });
    await version.save();

    logger.info('Trigger created successfully', {
        triggerId: trigger._id,
        contractId: trigger.contractId,
        eventName: trigger.eventName,
        isActive: trigger.isActive,
    });

    res.status(201).json({
        success: true,
        data: trigger,
    });
});

exports.getTriggers = asyncHandler(async (req, res) => {
    logger.debug('Fetching all triggers', { ip: req.ip });

    const triggers = await Trigger.find();

    logger.info('Triggers fetched successfully', {
        count: triggers.length,
        ip: req.ip,
    });

    res.json({
        success: true,
        data: triggers,
    });
});

exports.deleteTrigger = asyncHandler(async (req, res) => {
    logger.info('Deleting trigger', {
        triggerId: req.params.id,
        ip: req.ip,
    });

    const trigger = await Trigger.findByIdAndDelete(req.params.id);

    if (!trigger) {
        logger.warn('Trigger not found for deletion', {
            triggerId: req.params.id,
            ip: req.ip,
        });

        throw new AppError('Trigger not found', 404);
    }

    logger.info('Trigger deleted successfully', {
        triggerId: req.params.id,
        contractId: trigger.contractId,
        eventName: trigger.eventName,
        ip: req.ip,
    });

    res.status(204).send();
});

exports.updateTrigger = asyncHandler(async (req, res) => {
    logger.info('Updating trigger', {
        triggerId: req.params.id,
        ip: req.ip,
    });

    const trigger = await Trigger.findById(req.params.id);
    if (!trigger) {
        throw new AppError('Trigger not found', 404);
    }

    // Determine change type
    const statusFields = ['isActive', 'lastPolledLedger', 'totalExecutions', 'failedExecutions', 'lastSuccessAt'];
    const isStatusChange = Object.keys(req.body).every(key => statusFields.includes(key));
    const changeType = isStatusChange ? 'status' : 'config';

    // Get next version
    const lastVersion = await TriggerVersion.findOne({ triggerId: req.params.id }).sort({ version: -1 });
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    // Save version snapshot
    const version = new TriggerVersion({
        triggerId: trigger._id,
        version: nextVersion,
        snapshot: trigger.toObject(),
        changeType,
        changedBy: req.user ? req.user._id : 'system',
        changeDescription: `Updated ${changeType} fields`
    });
    await version.save();

    // Update trigger
    const updatedTrigger = await Trigger.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    logger.info('Trigger updated successfully', {
        triggerId: req.params.id,
        contractId: updatedTrigger.contractId,
        eventName: updatedTrigger.eventName,
        batchingEnabled: updatedTrigger.batchingConfig?.enabled,
        ip: req.ip,
    });

    res.json({
        success: true,
        data: updatedTrigger,
    });
});

exports.getTriggerVersions = asyncHandler(async (req, res) => {
    logger.info('Fetching trigger versions', {
        triggerId: req.params.id,
        ip: req.ip,
    });

    const versions = await TriggerVersion.find({ triggerId: req.params.id }).sort({ version: -1 });

    logger.info('Trigger versions fetched successfully', {
        triggerId: req.params.id,
        count: versions.length,
        ip: req.ip,
    });

    res.json({
        success: true,
        data: versions,
    });
});

exports.restoreTriggerVersion = asyncHandler(async (req, res) => {
    logger.info('Restoring trigger version', {
        triggerId: req.params.id,
        version: req.params.version,
        ip: req.ip,
    });

    const version = await TriggerVersion.findOne({ triggerId: req.params.id, version: req.params.version });
    if (!version) {
        throw new AppError('Version not found', 404);
    }

    // Restore the snapshot
    const { _id, createdAt, updatedAt, ...snapshotData } = version.snapshot;
    const updatedTrigger = await Trigger.findByIdAndUpdate(
        req.params.id,
        snapshotData,
        { new: true, runValidators: true }
    );

    if (!updatedTrigger) {
        throw new AppError('Trigger not found', 404);
    }

    // Save a new version for the restore
    const lastVersion = await TriggerVersion.findOne({ triggerId: req.params.id }).sort({ version: -1 });
    const nextVersion = lastVersion.version + 1;
    const restoreVersion = new TriggerVersion({
        triggerId: updatedTrigger._id,
        version: nextVersion,
        snapshot: updatedTrigger.toObject(),
        changeType: 'config',
        changedBy: req.user ? req.user._id : 'system',
        changeDescription: `Restored to version ${req.params.version}`
    });
    await restoreVersion.save();

    logger.info('Trigger version restored successfully', {
        triggerId: req.params.id,
        restoredVersion: req.params.version,
        newVersion: nextVersion,
        ip: req.ip,
    });

    res.json({
        success: true,
        data: updatedTrigger,
    });
});

exports.regenerateWebhookSecret = asyncHandler(async (req, res) => {
    logger.info('Regenerating webhook secret', {
        triggerId: req.params.id,
        ip: req.ip,
    });

    const trigger = await Trigger.findById(req.params.id);

    if (!trigger) {
        logger.warn('Trigger not found for webhook secret regeneration', {
            triggerId: req.params.id,
            ip: req.ip,
        });

        throw new AppError('Trigger not found', 404);
    }

    if (trigger.actionType !== 'webhook') {
        logger.warn('Attempted to regenerate webhook secret for non-webhook trigger', {
            triggerId: req.params.id,
            actionType: trigger.actionType,
            ip: req.ip,
        });

        throw new AppError('Webhook secret regeneration is only available for webhook triggers', 400);
    }

    const oldSecret = trigger.webhookSecret;
    trigger.webhookSecret = require('crypto').randomBytes(32).toString('hex');
    await trigger.save();

    logger.info('Webhook secret regenerated successfully', {
        triggerId: req.params.id,
        contractId: trigger.contractId,
        oldSecretPrefix: oldSecret.substring(0, 8),
        newSecretPrefix: trigger.webhookSecret.substring(0, 8),
        ip: req.ip,
    });

    res.json({
        success: true,
        message: 'Webhook secret regenerated successfully',
        data: {
            triggerId: trigger._id,
            webhookSecret: trigger.webhookSecret,
        },
    });
});
