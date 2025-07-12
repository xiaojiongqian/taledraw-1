// API module unit tests
import { generateImageWithImagen, generateTaleStream } from '../api';

// Mock Firebase functions
const mockHttpsCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockHttpsCallable),
}));

jest.mock('../firebase', () => ({
  functions: {},
}));

jest.mock('../config', () => ({
  UTILS: {
    formatLogMessage: (pageIndex, message) => `Page ${pageIndex + 1}: ${message}`,
    formatErrorMessage: (message) => `Image generation API returned error: ${message}`,
  },
}));

describe('API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console mocks
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  describe('generateImageWithImagen', () => {
    const defaultParams = {
      prompt: 'A beautiful forest scene',
      pageIndex: 0,
      aspectRatio: '1:1',
      pageData: {
        sceneCharacters: ['Hero'],
        sceneType: '主角场景'
      },
      allCharacters: {
        'Hero': {
          appearance: 'Young brave knight',
          clothing: 'Silver armor',
          personality: 'Courageous'
        }
      },
      artStyle: '儿童绘本插画风格',
      model: 'imagen4-fast'
    };

    it('should generate image successfully with default parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          imageUrl: 'https://example.com/generated-image.jpg'
        }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      const result = await generateImageWithImagen(
        defaultParams.prompt,
        defaultParams.pageIndex,
        defaultParams.aspectRatio,
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model
      );

      expect(result).toBe('https://example.com/generated-image.jpg');
      expect(mockHttpsCallable).toHaveBeenCalledWith({
        prompt: expect.stringContaining('A beautiful forest scene'),
        pageIndex: 0,
        aspectRatio: '1:1',
        model: 'imagen4-fast',
        seed: 42,
        maxRetries: 0,
        sampleCount: 1,
        safetyFilterLevel: 'OFF',
        personGeneration: 'allow_all',
        addWatermark: false,
        negativePrompt: expect.stringContaining('text, words, letters')
      });
    });

    it('should handle different scene types correctly', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      // Test no character scene
      const noCharacterParams = {
        ...defaultParams,
        pageData: { sceneType: '无角色场景', sceneCharacters: [] }
      };

      await generateImageWithImagen(
        noCharacterParams.prompt,
        noCharacterParams.pageIndex,
        noCharacterParams.aspectRatio,
        noCharacterParams.pageData,
        noCharacterParams.allCharacters,
        noCharacterParams.artStyle,
        noCharacterParams.model
      );

      const callArgs = mockHttpsCallable.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Focus on the scene and environment only, no characters should appear');
    });

    it('should handle different aspect ratios', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      // Test vertical aspect ratio
      await generateImageWithImagen(
        defaultParams.prompt,
        defaultParams.pageIndex,
        '9:16',
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model
      );

      const verticalCall = mockHttpsCallable.mock.calls[0][0];
      expect(verticalCall.prompt).toContain('Vertical composition, portrait orientation');

      mockHttpsCallable.mockClear();

      // Test horizontal aspect ratio
      await generateImageWithImagen(
        defaultParams.prompt,
        defaultParams.pageIndex,
        '16:9',
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model
      );

      const horizontalCall = mockHttpsCallable.mock.calls[0][0];
      expect(horizontalCall.prompt).toContain('Horizontal composition, landscape orientation');
    });

    it('should handle progress callback correctly', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);
      const onProgress = jest.fn();

      await generateImageWithImagen(
        defaultParams.prompt,
        defaultParams.pageIndex,
        defaultParams.aspectRatio,
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model,
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('Generating page 1 illustration'),
        'image'
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('Calling imagen4-fast API'),
        'image'
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('illustration generated successfully'),
        'success'
      );
    });

    it('should handle API errors correctly', async () => {
      const mockError = new Error('API Error');
      mockHttpsCallable.mockRejectedValue(mockError);

      const onProgress = jest.fn();

      await expect(
        generateImageWithImagen(
          defaultParams.prompt,
          defaultParams.pageIndex,
          defaultParams.aspectRatio,
          defaultParams.pageData,
          defaultParams.allCharacters,
          defaultParams.artStyle,
          defaultParams.model,
          onProgress
        )
      ).rejects.toThrow();

      expect(onProgress).toHaveBeenCalledWith(
        expect.stringContaining('image generation failed'),
        'error'
      );
    });

    it('should handle unsuccessful API responses', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Content filtered by safety guidelines'
        }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      await expect(
        generateImageWithImagen(
          defaultParams.prompt,
          defaultParams.pageIndex,
          defaultParams.aspectRatio,
          defaultParams.pageData,
          defaultParams.allCharacters,
          defaultParams.artStyle,
          defaultParams.model
        )
      ).rejects.toThrow('Content filtered by safety guidelines');
    });

    it('should handle different models correctly', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      const models = ['imagen3', 'imagen4', 'imagen4-fast'];

      for (const model of models) {
        mockHttpsCallable.mockClear();
        
        await generateImageWithImagen(
          defaultParams.prompt,
          defaultParams.pageIndex,
          defaultParams.aspectRatio,
          defaultParams.pageData,
          defaultParams.allCharacters,
          defaultParams.artStyle,
          model
        );

        const callArgs = mockHttpsCallable.mock.calls[0][0];
        expect(callArgs.model).toBe(model);
      }
    });

    it('should build character descriptions correctly', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      const multiCharacterParams = {
        ...defaultParams,
        pageData: {
          sceneType: '群体场景',
          sceneCharacters: ['Hero', 'Villain']
        },
        allCharacters: {
          'Hero': {
            appearance: 'Young brave knight',
            clothing: 'Silver armor'
          },
          'Villain': {
            appearance: 'Dark sorcerer',
            clothing: 'Black robes'
          }
        }
      };

      await generateImageWithImagen(
        multiCharacterParams.prompt,
        multiCharacterParams.pageIndex,
        multiCharacterParams.aspectRatio,
        multiCharacterParams.pageData,
        multiCharacterParams.allCharacters,
        multiCharacterParams.artStyle,
        multiCharacterParams.model
      );

      const callArgs = mockHttpsCallable.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Young brave knight');
      expect(callArgs.prompt).toContain('Dark sorcerer');
    });

    it('should handle missing character data gracefully', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      const missingCharacterParams = {
        ...defaultParams,
        pageData: {
          sceneType: '主角场景',
          sceneCharacters: ['UnknownCharacter']
        },
        allCharacters: {} // Empty characters object
      };

      await generateImageWithImagen(
        missingCharacterParams.prompt,
        missingCharacterParams.pageIndex,
        missingCharacterParams.aspectRatio,
        missingCharacterParams.pageData,
        missingCharacterParams.allCharacters,
        missingCharacterParams.artStyle,
        missingCharacterParams.model
      );

      // Should not throw and handle gracefully
      expect(mockHttpsCallable).toHaveBeenCalled();
    });

    it('should use correct seed based on page index', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      await generateImageWithImagen(
        defaultParams.prompt,
        3, // Page index 3
        defaultParams.aspectRatio,
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model
      );

      const callArgs = mockHttpsCallable.mock.calls[0][0];
      expect(callArgs.seed).toBe(45); // 42 + 3
    });

    it('should include proper negative prompts', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      await generateImageWithImagen(
        defaultParams.prompt,
        defaultParams.pageIndex,
        defaultParams.aspectRatio,
        defaultParams.pageData,
        defaultParams.allCharacters,
        defaultParams.artStyle,
        defaultParams.model
      );

      const callArgs = mockHttpsCallable.mock.calls[0][0];
      expect(callArgs.negativePrompt).toContain('text');
      expect(callArgs.negativePrompt).toContain('words');
      expect(callArgs.negativePrompt).toContain('blurry');
      expect(callArgs.negativePrompt).toContain('low quality');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty pageData gracefully', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      await generateImageWithImagen(
        'Test prompt',
        0,
        '1:1',
        {}, // Empty pageData
        {},
        'Test style',
        'imagen4-fast'
      );

      expect(mockHttpsCallable).toHaveBeenCalled();
    });

    it('should handle null/undefined parameters', async () => {
      const mockResponse = {
        data: { success: true, imageUrl: 'https://example.com/image.jpg' }
      };
      mockHttpsCallable.mockResolvedValue(mockResponse);

      await generateImageWithImagen(
        'Test prompt',
        0,
        undefined, // undefined aspectRatio
        null, // null pageData
        undefined, // undefined allCharacters
        null, // null artStyle
        'imagen4-fast'
      );

      expect(mockHttpsCallable).toHaveBeenCalled();
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'TIMEOUT';
      mockHttpsCallable.mockRejectedValue(timeoutError);

      await expect(
        generateImageWithImagen(
          'Test prompt',
          0,
          '1:1',
          {},
          {},
          'Test style',
          'imagen4-fast'
        )
      ).rejects.toThrow('Network timeout');
    });
  });
});