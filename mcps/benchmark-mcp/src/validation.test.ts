import { validateHttpUrl, validateHeaders, errorResult, successResult } from './validation.js';

describe('Validation helpers', () => {
  describe('validateHttpUrl', () => {
    it('should accept valid http URLs', () => {
      const url = validateHttpUrl('http://example.com');
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe('http://example.com/');
    });

    it('should accept valid https URLs', () => {
      const url = validateHttpUrl('https://example.com/path?query=value');
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe('https://example.com/path?query=value');
    });

    it('should accept URLs with ports', () => {
      const url = validateHttpUrl('http://localhost:3000');
      expect(url).toBeInstanceOf(URL);
      expect(url.port).toBe('3000');
    });

    it('should reject invalid URLs', () => {
      expect(() => validateHttpUrl('not-a-url'))
        .toThrow('Invalid URL');
    });

    it('should reject ftp URLs', () => {
      expect(() => validateHttpUrl('ftp://example.com'))
        .toThrow('Only http/https URLs are allowed');
    });

    it('should reject file URLs', () => {
      expect(() => validateHttpUrl('file:///etc/passwd'))
        .toThrow('Only http/https URLs are allowed');
    });

    it('should reject javascript URLs', () => {
      expect(() => validateHttpUrl('javascript:alert(1)'))
        .toThrow('Only http/https URLs are allowed');
    });
  });

  describe('validateHeaders', () => {
    it('should accept valid headers', () => {
      const headers = validateHeaders({ 'Content-Type': 'application/json', 'Authorization': 'Bearer token' });
      expect(headers).toEqual({ 'Content-Type': 'application/json', 'Authorization': 'Bearer token' });
    });

    it('should accept empty headers', () => {
      const headers = validateHeaders({});
      expect(headers).toEqual({});
    });

    it('should reject headers with newlines in key', () => {
      expect(() => validateHeaders({ 'Content-Type\r\n': 'value' }))
        .toThrow('Invalid header key');
    });

    it('should reject headers with newlines in value', () => {
      expect(() => validateHeaders({ 'Content-Type': 'value\r\nInjection' }))
        .toThrow('Invalid header value');
    });

    it('should reject headers with quotes in key', () => {
      expect(() => validateHeaders({ 'Content-"Type': 'value' }))
        .toThrow('Invalid header key');
    });

    it('should reject headers with quotes in value', () => {
      expect(() => validateHeaders({ 'Content-Type': 'value"Injection' }))
        .toThrow('Invalid header value');
    });

    it('should reject headers with backticks in key', () => {
      expect(() => validateHeaders({ 'Content-`Type': 'value' }))
        .toThrow('Invalid header key');
    });
  });

  describe('errorResult', () => {
    it('should create error payload with correct structure', () => {
      const result = errorResult('TEST_ERROR', 'Test message', true);
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      
      const payload = JSON.parse(String(result.content[0]?.text));
      expect(payload).toEqual({
        success: false,
        error: { code: 'TEST_ERROR', message: 'Test message', retryable: true }
      });
    });

    it('should set retryable to false when specified', () => {
      const result = errorResult('TEST_ERROR', 'Test message', false);
      const payload = JSON.parse(String(result.content[0]?.text));
      expect(payload.error.retryable).toBe(false);
    });
  });

  describe('successResult', () => {
    it('should create success payload with correct structure', () => {
      const result = successResult({ data: 'test' });
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      
      const payload = JSON.parse(String(result.content[0]?.text));
      expect(payload).toEqual({
        success: true,
        data: { data: 'test' }
      });
    });

    it('should handle complex data', () => {
      const result = successResult({ nested: { array: [1, 2, 3], value: 'test' } });
      const payload = JSON.parse(String(result.content[0]?.text));
      expect(payload.success).toBe(true);
      expect(payload.data.nested.array).toEqual([1, 2, 3]);
    });

    it('should handle null data', () => {
      const result = successResult(null);
      const payload = JSON.parse(String(result.content[0]?.text));
      expect(payload.success).toBe(true);
      expect(payload.data).toBeNull();
    });
  });
});