/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Automatically generates Data Center Work Orders and alerts NOC technicians when a
 * Sales Order containing Interconnection (Cross-Connect) items transitions to Pending Fulfillment.
 */

define([
    'N/record',
    'N/runtime',
    '../lib/provisioning_util'
], (nsRecord, runtime, provisioningUtils) => {

    const SALES_ORDER_FIELDS = {
        ORDER_STATUS: 'orderstatus',
        STATUS_PENDING_FULFILLMENT: 'B',
        TRAN_ID: 'tranid',
        ENTITY: 'entity',
        LOCATION: 'location',
        ITEM_SUBLIST: 'item',
        LINE_ITEM: 'item',
        LINE_CLASS: 'class',
        LINE_A_SIDE_RACK: 'custcol_a_side_rack_port',
        LINE_Z_SIDE_RACK: 'custcol_z_side_rack_port',
        LINE_MEDIA_TYPE: 'custcol_fiber_media_type',
        LINE_SLA_DATE: 'custcol_provisioning_sla_date',
        LINE_WORK_ORDER_REF: 'custcol_provisioned_wo_ref'
    };

    const DC_WORK_ORDER_RECORD = {
        TYPE: 'customrecord_datacenter_work_order',
        SALES_ORDER: 'custrecord_wo_sales_order',
        CUSTOMER: 'custrecord_wo_customer',
        FACILITY: 'custrecord_wo_facility',
        ITEM: 'custrecord_wo_service_item',
        A_SIDE_PORT: 'custrecord_wo_a_side_port',
        Z_SIDE_PORT: 'custrecord_wo_z_side_port',
        MEDIA_TYPE: 'custrecord_wo_media_type',
        SLA_DUE_DATE: 'custrecord_wo_sla_due_date'
    };

    const afterSubmit = (context) => {
        // Guard: Only trigger on the exact transition into "Pending Fulfillment"
        if (!isNewlyApprovedOrder(context)) {
            return;
        }

        const scriptObj = runtime.getCurrentScript();
        const interconnectionClassId = String(scriptObj.getParameter({ name: 'custscript_interconnect_class_id' }) || '');
        const networkOpsCenterAuthorId = scriptObj.getParameter({ name: 'custscript_noc_email_author' });
        const networkOpsCenterQueueEmail = scriptObj.getParameter({ name: 'custscript_noc_queue_email' });

        if (!interconnectionClassId) {
            log.error('Configuration Missing', 'Script parameter custscript_interconnect_class_id is required.');
            return;
        }

        // Inspect all Sales Order lines for unprovisioned Interconnection items
        const linesToProvision = extractUnprovisionedLines(context.newRecord, interconnectionClassId);
        if (linesToProvision.length === 0) {
            return;
        }

        const orderNumber = context.newRecord.getValue({ fieldId: SALES_ORDER_FIELDS.TRAN_ID });

        const lineUpdates = linesToProvision.map(({ lineIndex, workOrderFields }) => {
            const workOrderId = provisioningUtils.createCustomRecord({
                recordType: DC_WORK_ORDER_RECORD.TYPE,
                fieldValues: workOrderFields
            });

            // Dispatch NOC notification with clickable URL for each new Work Order
            provisioningUtils.sendRecordAlertEmail({
                authorId: networkOpsCenterAuthorId,
                recipientEmail: networkOpsCenterQueueEmail,
                recordType: DC_WORK_ORDER_RECORD.TYPE,
                recordId: workOrderId,
                subject: `[NOC Provisioning] New Cross-Connect Work Order #${workOrderId} (Sales Order #${orderNumber})`,
                bodyIntro: `Sales Order #${orderNumber} has been approved for fulfillment. A new Cross-Connect Work Order (#${workOrderId}) has been queued for technician provisioning.`
            });

            return { lineIndex, value: workOrderId };
        });

        // Stamp generated Work Order IDs back onto the Sales Order lines
        provisioningUtils.stampSublistFieldValues({
            recordType: nsRecord.Type.SALES_ORDER,
            recordId: context.newRecord.id,
            sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST,
            fieldId: SALES_ORDER_FIELDS.LINE_WORK_ORDER_REF,
            lineUpdates
        });

        log.audit('Cross-Connect Provisioning Complete', `Sales Order #${orderNumber} | Work Orders Created: ${lineUpdates.length}`);
    };

    // --- Helper Functions ---

    function isNewlyApprovedOrder(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return false;
        }

        const newStatus = context.newRecord.getValue({ fieldId: SALES_ORDER_FIELDS.ORDER_STATUS });
        const oldStatus = context.oldRecord ? context.oldRecord.getValue({ fieldId: SALES_ORDER_FIELDS.ORDER_STATUS }) : null;

        return newStatus === SALES_ORDER_FIELDS.STATUS_PENDING_FULFILLMENT &&
               oldStatus !== SALES_ORDER_FIELDS.STATUS_PENDING_FULFILLMENT;
    }

    function extractUnprovisionedLines(salesOrderRecord, targetClassId) {
        const lineCount = salesOrderRecord.getLineCount({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST });
        const customerId = salesOrderRecord.getValue({ fieldId: SALES_ORDER_FIELDS.ENTITY });
        const facilityId = salesOrderRecord.getValue({ fieldId: SALES_ORDER_FIELDS.LOCATION });
        const pendingLines = [];

        for (let i = 0; i < lineCount; i++) {
            const rawLineClass = salesOrderRecord.getSublistValue({
                sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST,
                fieldId: SALES_ORDER_FIELDS.LINE_CLASS,
                line: i
            });

            if (!rawLineClass || String(rawLineClass) !== targetClassId) {
                continue;
            }

            const existingWorkOrder = salesOrderRecord.getSublistValue({
                sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST,
                fieldId: SALES_ORDER_FIELDS.LINE_WORK_ORDER_REF,
                line: i
            });

            if (existingWorkOrder) {
                continue;
            }

            pendingLines.push({
                lineIndex: i,
                workOrderFields: {
                    [DC_WORK_ORDER_RECORD.SALES_ORDER]: salesOrderRecord.id,
                    [DC_WORK_ORDER_RECORD.CUSTOMER]: customerId,
                    [DC_WORK_ORDER_RECORD.FACILITY]: facilityId,
                    [DC_WORK_ORDER_RECORD.ITEM]: salesOrderRecord.getSublistValue({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST, fieldId: SALES_ORDER_FIELDS.LINE_ITEM, line: i }),
                    [DC_WORK_ORDER_RECORD.A_SIDE_PORT]: salesOrderRecord.getSublistValue({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST, fieldId: SALES_ORDER_FIELDS.LINE_A_SIDE_RACK, line: i }),
                    [DC_WORK_ORDER_RECORD.Z_SIDE_PORT]: salesOrderRecord.getSublistValue({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST, fieldId: SALES_ORDER_FIELDS.LINE_Z_SIDE_RACK, line: i }),
                    [DC_WORK_ORDER_RECORD.MEDIA_TYPE]: salesOrderRecord.getSublistValue({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST, fieldId: SALES_ORDER_FIELDS.LINE_MEDIA_TYPE, line: i }),
                    [DC_WORK_ORDER_RECORD.SLA_DUE_DATE]: salesOrderRecord.getSublistValue({ sublistId: SALES_ORDER_FIELDS.ITEM_SUBLIST, fieldId: SALES_ORDER_FIELDS.LINE_SLA_DATE, line: i })
                }
            });
        }

        return pendingLines;
    }

    return {
        afterSubmit
    };
});
