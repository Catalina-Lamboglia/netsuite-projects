/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 * @description Ingests customer portal "Remote Hands" requests (e.g., server reboots, hardware checks)
 * and creates a billable NetSuite Support Case for on-site technician dispatch.
 */

define([
    'N/record',
    'N/runtime',
    'N/error',
    '../lib/restlet_request_validator'
], (record, runtime, error, requestValidator) => {

    const DISPATCH_CASE = {
        RECORD_TYPE: record.Type.SUPPORT_CASE,
        COMPANY: 'company',
        TITLE: 'title',
        INCOMING_MESSAGE: 'incomingmessage',
        ORIGIN: 'origin',
        EXTERNAL_TICKET_ID: 'custevent_portal_dispatch_id',
        FACILITY: 'custevent_datacenter_facility',
        RACK_CABINET: 'custevent_rack_cabinet_id',
        EST_TECH_HOURS: 'custevent_est_technician_hours'
    };

    const REQUIRED_PAYLOAD_KEYS = [
        'externalTicketId',
        'customerId',
        'facilityId',
        'rackCabinetId',
        'actionRequested'
    ];

    /**
     * POST Handler: Receives a Remote Hands service request from the customer portal
     * and dispatches a billable Support Case to on-site technicians.
     *
     * Sample JSON Payload:
     * {
     *   "externalTicketId": "RH-90421",
     *   "customerId": 1042,
     *   "facilityId": 5,
     *   "rackCabinetId": "CAGE-14-RACK-B4",
     *   "actionRequested": "Power-cycle / reboot physical server in slot U12",
     *   "instructions": "Verify amber PSU LED clears after hard reboot.",
     *   "estimatedTechHours": 1.0
     * }
     *
     * @param {Object} requestBody - Automatically parsed JSON body from NetSuite RESTlet engine
     * @returns {Object} Standardized JSON response with NetSuite Case Internal ID
     */
    const post = (requestBody) => {
        try {
            requestValidator.validateRequiredFields(requestBody, REQUIRED_PAYLOAD_KEYS);

            // Idempotency check: Return existing Case ID if this dispatch request was already ingested
            const existingCaseId = requestValidator.findExistingRecordByExternalId({
                recordType: DISPATCH_CASE.RECORD_TYPE,
                externalIdField: DISPATCH_CASE.EXTERNAL_TICKET_ID,
                externalIdValue: requestBody.externalTicketId
            });

            if (existingCaseId) {
                log.audit('Duplicate Remote Hands Request Ignored', `Portal ID: ${requestBody.externalTicketId} | Existing Case ID: ${existingCaseId}`);
                return {
                    success: true,
                    status: 200,
                    message: 'Remote Hands request already synced; returning existing dispatch case.',
                    internalId: existingCaseId,
                    externalTicketId: requestBody.externalTicketId
                };
            }

            // Create Support Case for On-Site Technician Dispatch & Billing
            const caseRec = record.create({
                type: DISPATCH_CASE.RECORD_TYPE,
                isDynamic: true
            });

            caseRec.setValue({ fieldId: DISPATCH_CASE.COMPANY, value: requestBody.customerId });
            caseRec.setValue({
                fieldId: DISPATCH_CASE.TITLE,
                value: `Remote Hands [${requestBody.rackCabinetId}]: ${requestBody.actionRequested}`
            });
            caseRec.setValue({
                fieldId: DISPATCH_CASE.INCOMING_MESSAGE,
                value: requestBody.instructions || requestBody.actionRequested
            });
            caseRec.setValue({ fieldId: DISPATCH_CASE.EXTERNAL_TICKET_ID, value: String(requestBody.externalTicketId) });
            caseRec.setValue({ fieldId: DISPATCH_CASE.FACILITY, value: requestBody.facilityId });
            caseRec.setValue({ fieldId: DISPATCH_CASE.RACK_CABINET, value: requestBody.rackCabinetId });

            // Optional script parameter for Case Origin routing
            const portalOriginId = runtime.getCurrentScript().getParameter({ name: 'custscript_portal_case_origin' });
            if (portalOriginId) {
                caseRec.setValue({ fieldId: DISPATCH_CASE.ORIGIN, value: portalOriginId });
            }

            if (requestBody.estimatedTechHours !== undefined) {
                caseRec.setValue({
                    fieldId: DISPATCH_CASE.EST_TECH_HOURS,
                    value: parseFloat(requestBody.estimatedTechHours) || 0
                });
            }

            const newCaseId = caseRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            log.audit('Remote Hands Ticket Created', `Portal ID: ${requestBody.externalTicketId} | Case ID: ${newCaseId}`);

            return {
                success: true,
                status: 201,
                message: 'Remote Hands dispatch ticket created successfully.',
                internalId: newCaseId,
                externalTicketId: requestBody.externalTicketId
            };

        } catch (e) {
            log.error('Remote Hands RESTlet Error', {
                errorName: e.name,
                errorMessage: e.message,
                payload: requestBody
            });

            throw error.create({
                name: e.name || 'REMOTE_HANDS_SYNC_FAILED',
                message: e.message,
                notifyOff: true
            });
        }
    };

    return {
        post
    };
});
