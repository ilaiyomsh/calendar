import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('./utils/logger', () => ({
    default: {
        setLevel: vi.fn(),
        getLevel: vi.fn(),
        isDebug: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        api: vi.fn(),
        apiResponse: vi.fn(),
        apiError: vi.fn(),
        functionStart: vi.fn(),
        functionEnd: vi.fn(),
    }
}));
