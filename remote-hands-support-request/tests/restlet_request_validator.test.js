let loadedModule;
global.define = (dependencies, factory) => {
    loadedModule = factory(...dependencies.map(dep => require(dep)));
};


// Mock N/search
const mockEach = jest.fn();
jest.mock('N/search', () => ({
    create: jest.fn(() => ({
        run: () => ({ each: mockEach })
    }))
}), { virtual: true });

// Mock N/error
jest.mock('N/error', () => ({
    create: jest.fn(({ name, message }) => {
        const err = new Error(message);
        err.name = name;
        return err;
    })
}), { virtual: true });

require('../src/lib/restlet_request_validator');
const search = require('N/search');
const error = require('N/error');

describe('restlet_request_validator.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- assertJsonPayloadHasKeys Tests ---

    test('assertJsonPayloadHasKeys passes when all mandatory keys are populated', () => {
        const payload = {
            externalTicketId: 'RH-100',
            customerId: 1042,
            rackCabinetId: 'RACK-B4'
        };

        expect(() => {
            loadedModule.assertJsonPayloadHasKeys(payload, ['externalTicketId', 'customerId', 'rackCabinetId']);
        }).not.toThrow();
    });

    test('assertJsonPayloadHasKeys throws INVALID_JSON_PAYLOAD if body is null or an array', () => {
        expect(() => {
            loadedModule.assertJsonPayloadHasKeys(['not', 'an', 'object'], ['customerId']);
        }).toThrow('Request body must be a valid JSON object.');

        expect(error.create).toHaveBeenCalledWith(expect.objectContaining({
            name: 'INVALID_JSON_PAYLOAD',
            notifyOff: true
        }));
    });

    test('assertJsonPayloadHasKeys throws MISSING_REQUIRED_PAYLOAD_KEYS listing missing fields', () => {
        const incompletePayload = {
            externalTicketId: 'RH-100',
            customerId: '' // Empty string should fail
        };

        expect(() => {
            loadedModule.assertJsonPayloadHasKeys(incompletePayload, ['externalTicketId', 'customerId', 'rackCabinetId']);
        }).toThrow('Missing required payload key(s): customerId, rackCabinetId');
    });

    // --- lookupDuplicateExternalId Tests ---

    test('lookupDuplicateExternalId returns existing Internal ID when a duplicate exists', () => {
        mockEach.mockImplementation((callback) => {
            callback({ id: '58219' });
        });

        const existingId = loadedModule.lookupDuplicateExternalId({
            recordType: 'supportcase',
            externalIdField: 'custevent_portal_dispatch_id',
            externalIdValue: 'RH-100'
        });

        expect(existingId).toBe('58219');
        expect(search.create).toHaveBeenCalledWith({
            type: 'supportcase',
            filters: [['custevent_portal_dispatch_id', 'is', 'RH-100']],
            columns: ['internalid']
        });
    });

    test('lookupDuplicateExternalId returns null when no matching record exists', () => {
        mockEach.mockImplementation(() => {
            // Simulate zero search results
        });

        const existingId = loadedModule.lookupDuplicateExternalId({
            recordType: 'supportcase',
            externalIdField: 'custevent_portal_dispatch_id',
            externalIdValue: 'RH-999'
        });

        expect(existingId).toBeNull();
    });
});
