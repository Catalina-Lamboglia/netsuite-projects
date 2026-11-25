/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @description Reusable RESTlet helpers for asserting JSON payload keys and preventing duplicate external record ingestion.
 */

define(['N/search', 'N/error'], (search, error) => {

    // Asserts that the incoming request body is a valid object containing all mandatory keys; throws N/error if not.
    const assertJsonPayloadHasKeys = (payload, requiredKeys) => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw error.create({
                name: 'INVALID_JSON_PAYLOAD',
                message: 'Request body must be a valid JSON object.',
                notifyOff: true
            });
        }

        const missingKeys = requiredKeys.filter((key) => {
            const val = payload[key];
            return val === undefined || val === null || val === '';
        });

        if (missingKeys.length > 0) {
            throw error.create({
                name: 'MISSING_REQUIRED_PAYLOAD_KEYS',
                message: `Missing required payload key(s): ${missingKeys.join(', ')}`,
                notifyOff: true
            });
        }
    };

    // Searches NetSuite for an existing record matching the external system's ID to ensure webhook idempotency.
    const lookupDuplicateExternalId = ({ recordType, externalIdField, externalIdValue }) => {
        let existingInternalId = null;

        const duplicateSearch = search.create({
            type: recordType,
            filters: [
                [externalIdField, 'is', String(externalIdValue)]
            ],
            columns: ['internalid']
        });

        duplicateSearch.run().each((result) => {
            existingInternalId = result.id;
            return false;
        });

        return existingInternalId;
    };

    return {
        assertJsonPayloadHasKeys,
        lookupDuplicateExternalId
    };
});
