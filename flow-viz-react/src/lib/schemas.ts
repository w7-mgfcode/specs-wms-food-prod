import { z } from 'zod';

export const lotRegistrationSchema = z.object({
    lotType: z.enum(['RAW', 'DEB', 'BULK', 'MIX', 'SKW', 'FRZ', 'FG']),
    barcode: z.string().regex(/^[A-Z]{2,4}-\d{8}-[A-Z]{4}-\d{4}$/, "Invalid barcode format"),
    weight: z.number().min(0.1).max(1000).multipleOf(0.01),
    temperature: z.number().min(-40).max(40).multipleOf(0.1),
    supplierId: z.string().uuid().optional(),
    parentLots: z.array(z.object({
        lotId: z.string().uuid(),
        quantityUsed: z.number().positive()
    })).optional(),
    notes: z.string().max(500).optional()
}).refine(
    (data) => data.lotType !== 'RAW' || !!data.supplierId,
    { message: 'Supplier required for RAW lots', path: ['supplierId'] }
);

export type LotRegistrationInput = z.infer<typeof lotRegistrationSchema>;

export const qcDecisionSchema = z.object({
    gateId: z.string().uuid(),
    lotId: z.string().uuid(),
    decision: z.enum(['PASS', 'HOLD', 'FAIL']),
    notes: z.string().optional(),
    temperature: z.number().optional(),
    signature: z.string().optional()
}).refine(
    (data) => (data.decision === 'HOLD' || data.decision === 'FAIL') ? !!data.notes && data.notes.length > 10 : true,
    { message: 'Notes are mandatory (min 10 chars) for Hold/Fail decisions', path: ['notes'] }
);

export type QCDecisionInput = z.infer<typeof qcDecisionSchema>;
