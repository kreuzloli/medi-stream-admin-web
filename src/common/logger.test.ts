import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

describe('logger', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('writes a structured project prefix and context', () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

        logger.info('session restored', { adminId: 1 });

        expect(info).toHaveBeenCalledWith('[Medi Stream Admin] session restored', { adminId: 1 });
    });

    it('does not print an empty context object', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        logger.warn('session expired');

        expect(warn).toHaveBeenCalledWith('[Medi Stream Admin] session expired');
    });
});
