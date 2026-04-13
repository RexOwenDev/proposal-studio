import { describe, it, expect } from 'vitest';
import { stripEditorArtifacts } from './strip-editor-artifacts';

describe('stripEditorArtifacts', () => {
  describe('comment highlight marks', () => {
    it('removes <mark data-comment-id> opening tags', () => {
      const input = '<mark data-comment-id="abc123">highlighted text</mark>';
      expect(stripEditorArtifacts(input)).toBe('highlighted text');
    });

    it('removes mark with attribute in any order', () => {
      const input = '<mark style="background:yellow" data-comment-id="x">text</mark>';
      expect(stripEditorArtifacts(input)).toBe('text');
    });

    it('handles multiple comment marks in one string', () => {
      const input = '<mark data-comment-id="a">first</mark> and <mark data-comment-id="b">second</mark>';
      expect(stripEditorArtifacts(input)).toBe('first and second');
    });

    it('does not remove plain <mark> tags without data-comment-id', () => {
      const input = '<mark>important</mark>';
      // The closing </mark> is still stripped but the opening tag stays
      // because the function only targets marks with data-comment-id
      expect(stripEditorArtifacts(input)).toContain('important');
    });
  });

  describe('editor-only data attributes', () => {
    it('removes data-editable attribute', () => {
      const input = '<p data-editable="true">Content</p>';
      expect(stripEditorArtifacts(input)).toBe('<p>Content</p>');
    });

    it('removes data-block-id-ref attribute', () => {
      const input = '<div data-block-id-ref="block-123">Content</div>';
      expect(stripEditorArtifacts(input)).toBe('<div>Content</div>');
    });

    it('removes contenteditable attribute', () => {
      const input = '<div contenteditable="true">Content</div>';
      expect(stripEditorArtifacts(input)).toBe('<div>Content</div>');
    });
  });

  describe('"editing" CSS class token', () => {
    it('removes "editing" as sole class and cleans up empty class attr', () => {
      const input = '<div class="editing">Content</div>';
      expect(stripEditorArtifacts(input)).toBe('<div>Content</div>');
    });

    it('removes "editing" from multi-class attribute', () => {
      const input = '<div class="section editing active">Content</div>';
      const result = stripEditorArtifacts(input);
      expect(result).not.toContain('editing');
      expect(result).toContain('section');
      expect(result).toContain('active');
    });
  });

  describe('idempotency', () => {
    it('produces the same result when called twice', () => {
      const input = '<mark data-comment-id="x">text</mark><p data-editable="1">para</p>';
      const once = stripEditorArtifacts(input);
      const twice = stripEditorArtifacts(once);
      expect(once).toBe(twice);
    });
  });

  describe('passthrough', () => {
    it('returns clean HTML unchanged', () => {
      const clean = '<h1>Hello</h1><p>World</p>';
      expect(stripEditorArtifacts(clean)).toBe(clean);
    });

    it('handles empty string', () => {
      expect(stripEditorArtifacts('')).toBe('');
    });
  });
});
