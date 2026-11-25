let loadedModule;
global.define = (dependencies, factory) => {
    loadedModule = factory(...dependencies.map(dep => require(dep)));
};

// Suppress NetSuite global log calls during local Jest runs
global.log = { debug: jest.fn(), audit: jest.fn(), error: jest.fn() };

const mockCustomRec = {
    setValue: jest.fn(),
    save: jest.fn().mockReturnValue(801)
};

const mockEditableRec = {
    setSublistValue: jest.fn(),
    save: jest.fn().mockReturnValue(1042)
};

jest.mock('N/record', () => ({
    Type: { SALES_ORDER: 'salesorder' },
    create: jest.fn(() => mockCustomRec),
    load: jest.fn(() => mockEditableRec)
}), { virtual: true });

jest.mock('N/url', () => ({
    resolveRecord: jest.fn(() => 'https://netsuite.com')
}), { virtual: true });

jest.mock('N/email', () => ({
    send: jest.fn()
}), { virtual: true });

require('../src/lib/provisioning_util.js');
const nsRecord = require('N/record');
const url = require('N/url');
const email = require('N/email');

describe('provisioning_util.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- createCustomRecord Tests ---

    test('createCustomRecord sets only non-empty fields and returns new ID', () => {
        const newId = loadedModule.createCustomRecord({
            recordType: 'customrecord_datacenter_work_order',
            fieldValues: {
                custrecord_wo_sales_order: 1042,
                custrecord_wo_a_side_port: 'CAGE-1-P01',
                custrecord_wo_z_side_port: '',       // Should be skipped
                custrecord_wo_media_type: null       // Should be skipped
            }
        });

        expect(newId).toBe(801);
        expect(nsRecord.create).toHaveBeenCalledWith({
            type: 'customrecord_datacenter_work_order',
            isDynamic: true
        });
        expect(mockCustomRec.setValue).toHaveBeenCalledTimes(2);
        expect(mockCustomRec.save).toHaveBeenCalledTimes(1);
    });

    test('createCustomRecord throws before touching N/record if fieldValues is an array or empty', () => {
        expect(() => {
            loadedModule.createCustomRecord({
                recordType: 'customrecord_datacenter_work_order',
                fieldValues: ['invalid', 'array']
            });
        }).toThrow('createCustomRecord requires a valid recordType and key-value fieldValues object.');

        expect(() => {
            loadedModule.createCustomRecord({
                recordType: 'customrecord_datacenter_work_order',
                fieldValues: { emptyField: '', nullField: null }
            });
        }).toThrow('No valid non-empty field values provided');

        expect(nsRecord.create).not.toHaveBeenCalled();
    });

    // --- stampSublistFieldValues Tests ---

    test('stampSublistFieldValues loads record in standard mode and updates specified lines', () => {
        loadedModule.stampSublistFieldValues({
            recordType: 'salesorder',
            recordId: 1042,
            sublistId: 'item',
            fieldId: 'custcol_provisioned_wo_ref',
            lineUpdates: [
                { lineIndex: 0, value: 801 },
                { lineIndex: 2, value: 802 }
            ]
        });

        expect(nsRecord.load).toHaveBeenCalledWith({
            type: 'salesorder',
            id: 1042,
            isDynamic: false
        });
        expect(mockEditableRec.setSublistValue).toHaveBeenCalledTimes(2);
        expect(mockEditableRec.save).toHaveBeenCalledWith({
            enableSourcing: false,
            ignoreMandatoryFields: true
        });
    });

    // --- sendRecordAlertEmail Tests ---

    test('sendRecordAlertEmail resolves record URL and dispatches email', () => {
        loadedModule.sendRecordAlertEmail({
            authorId: 55,
            recipientEmail: 'noc@example.com',
            recordType: 'customrecord_datacenter_work_order',
            recordId: 801,
            subject: 'New Work Order #801',
            bodyIntro: 'Work order queued.'
        });

        expect(url.resolveRecord).toHaveBeenCalledWith({
            recordType: 'customrecord_datacenter_work_order',
            recordId: 801,
            isEditMode: false
        });
        expect(email.send).toHaveBeenCalledWith(expect.objectContaining({
            author: 55,
            recipients: 'noc@example.com',
            subject: 'New Work Order #801'
        }));
    });
});
