/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Reusable utilities for generating operational work orders, updating sublist references, and sending record deep-link alerts.
 */

define(['N/record', 'N/url', 'N/email'], (nsRecord, url, email) => {

    // Creates a custom record from a flat key-value field map and returns its new Internal ID.
    const createCustomRecord = ({ recordType, fieldValues }) => {
        if (!recordType || !fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
            throw new Error('createCustomRecord requires a valid recordType and key-value fieldValues object.');
        }

        const validEntries = Object.entries(fieldValues).filter(([, value]) => {
            return value !== undefined && value !== null && value !== '';
        });

        if (validEntries.length === 0) {
            throw new Error(`Cannot create ${recordType}: No valid non-empty field values provided.`);
        }

        const customRec = nsRecord.create({
            type: recordType,
            isDynamic: true
        });

        validEntries.forEach(([fieldId, value]) => {
            customRec.setValue({ fieldId, value });
        });

        return customRec.save({
            enableSourcing: true,
            ignoreMandatoryFields: false
        });
    };

    // Loads a record in Standard Mode and stamps values onto specific sublist lines without triggering sourcing.
    const stampSublistFieldValues = ({ recordType, recordId, sublistId, fieldId, lineUpdates }) => {
        if (!lineUpdates || lineUpdates.length === 0) return;

        const editableRec = nsRecord.load({
            type: recordType,
            id: recordId,
            isDynamic: false
        });

        lineUpdates.forEach(({ lineIndex, value }) => {
            editableRec.setSublistValue({
                sublistId,
                fieldId,
                line: lineIndex,
                value
            });
        });

        editableRec.save({
            enableSourcing: false,
            ignoreMandatoryFields: true
        });
    };

    // Resolves a clickable NetSuite UI URL for a record and emails the target operations queue.
    const sendRecordAlertEmail = ({ authorId, recipientEmail, recordType, recordId, subject, bodyIntro }) => {
        if (!authorId || !recipientEmail) {
            log.debug('NOC Alert Skipped', 'Missing email author or recipient parameter.');
            return;
        }

        const recordUrl = url.resolveRecord({
            recordType,
            recordId,
            isEditMode: false
        });

        email.send({
            author: authorId,
            recipients: recipientEmail,
            subject,
            body: `${bodyIntro}\n\nDirect NetSuite Record Link:\n${recordUrl}`
        });
    };

    return {
        createCustomRecord,
        stampSublistFieldValues,
        sendRecordAlertEmail
    };
});
