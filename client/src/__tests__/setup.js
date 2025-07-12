// Test setup configuration
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock Firebase
jest.mock('../firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  },
}));

// Mock window.open for popup tests
global.window.open = jest.fn();

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock canvas for image processing tests
const mockCanvas = {
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
    toDataURL: jest.fn(() => 'data:image/png;base64,mock-image-data'),
  })),
  width: 0,
  height: 0,
  toDataURL: jest.fn(() => 'data:image/png;base64,mock-image-data'),
  toBlob: jest.fn((callback) => callback(new Blob(['mock'], { type: 'image/png' }))),
};

global.HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
global.HTMLCanvasElement.prototype.toDataURL = mockCanvas.toDataURL;
global.HTMLCanvasElement.prototype.toBlob = mockCanvas.toBlob;

// Mock Image constructor
global.Image = class {
  constructor() {
    setTimeout(() => {
      this.onload && this.onload();
    }, 100);
  }
  
  set src(value) {
    this._src = value;
  }
  
  get src() {
    return this._src;
  }
  
  get naturalWidth() {
    return 100;
  }
  
  get naturalHeight() {
    return 100;
  }
  
  get complete() {
    return true;
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});