// Mock NetSuite's global AMD `define()` wrapper so Node/Jest can load SuiteScript modules
let loadedModule;
global.define = (dependencies, factory) => {
    loadedModule = factory(...dependencies.map(dep => require(dep)));
};

// Mock NetSuite's `N/record` module
const mockRecordObj = {
    setValue: jest.fn(),
    selectNewLine: jest.fn(),
    setCurrentSublistValue: jest.fn(),
    commitLine: jest.fn(),
    save: jest.fn().mockReturnValue(9001) // Simulated new Invoice Internal ID
};

jest.mock('N/record', () => ({
    Type: { INVOICE: 'invoice' },
    create: jest.fn(() => mockRecordObj)
}), { virtual: true });

// Load the actual SuiteScript library under test
require('../src/lib/billing_util');
const record = require('N/record');

describe('billing_util.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Pure Math Tests ---

    test('calculateOverage computes exact overage quantity and dollar amount', () => {
        const result = loadedModule.calculateOverage(14.5, 10.0, 125.0);

        expect(result).toEqual({
            overageQty: 4.5,
            overageAmount: 562.5,
            isBillable: true
        });
    });

    test('calculateOverage returns isBillable: false when usage is at or below contracted limit', () => {
        expect(loadedModule.calculateOverage(10.0, 10.0, 125.0).isBillable).toBe(false);
        expect(loadedModule.calculateOverage(8.2, 10.0, 125.0).isBillable).toBe(false);
    });

    test('calculateOverage handles floating-point precision cleanly', () => {
        // 10.3 - 10.1 in raw JS is 0.1999999999999993; verify .toFixed(2) rounding works
        const result = loadedModule.calculateOverage(10.3, 10.1, 100);

        expect(result.overageQty).toBe(0.2);
        expect(result.overageAmount).toBe(20);
        expect(result.isBillable).toBe(true);
    });

    // --- NetSuite Record Builder Tests ---

    test('createConsolidatedInvoice builds a dynamic Invoice with all line items and returns ID', () => {
        const invoiceId = loadedModule.createConsolidatedInvoice({
            customerId: 1042,
            memo: 'Automated Usage Overage Billing - 2026-11',
            lines: [
                { itemId: 501, quantity: 2.5, rate: 100, description: 'Cabinet A1' },
                { itemId: 501, quantity: 1.0, rate: 100, description: 'Cabinet A2' }
            ]
        });

        expect(invoiceId).toBe(9001);
        expect(record.create).toHaveBeenCalledWith({ type: 'invoice', isDynamic: true });
        expect(mockRecordObj.setValue).toHaveBeenCalledWith({ fieldId: 'entity', value: 1042 });
        expect(mockRecordObj.commitLine).toHaveBeenCalledTimes(2);
        expect(mockRecordObj.save).toHaveBeenCalledTimes(1);
    });

    test('createConsolidatedInvoice throws error if lines array is empty', () => {
        expect(() => {
            loadedModule.createConsolidatedInvoice({
                customerId: 1042,
                memo: 'Empty Test',
                lines: []
            });
        }).toThrow('Cannot create invoice for Customer 1042: No billable lines provided.');

        expect(record.create).not.toHaveBeenCalled();
    });
});
