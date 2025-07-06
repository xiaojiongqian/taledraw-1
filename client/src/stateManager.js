// State Manager - Handles application state persistence and recovery
class StateManager {
  constructor() {
    this.STORAGE_KEY = 'taledraw_app_state';
    this.VERSION = '1.0.0';
  }

  // Save complete application state
  saveState(state) {
    try {
      const stateToSave = {
        version: this.VERSION,
        timestamp: Date.now(),
        userEmail: state.userEmail,
        story: state.story,
        storyTitle: state.storyTitle,
        pageCount: state.pageCount,
        aspectRatio: state.aspectRatio,
        artStyle: state.artStyle,
        allCharacters: state.allCharacters,
        character: state.character,
        pages: state.pages,
        storyWordCount: state.storyWordCount,
        generatedResult: state.generatedResult,
        isGenerating: state.isGenerating,
        hasGeneratedContent: state.pages && state.pages.length > 0
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
      console.log('State saved to localStorage');
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  }

  // Restore application state
  restoreState() {
    try {
      const savedState = localStorage.getItem(this.STORAGE_KEY);
      if (!savedState) {
        console.log('No saved state found');
        return null;
      }

      const parsedState = JSON.parse(savedState);
      
      // Check version compatibility
      if (parsedState.version !== this.VERSION) {
        console.warn('State version mismatch, clearing old data');
        this.clearState();
        return null;
      }

      // Check if state is expired (24 hours)
      const now = Date.now();
      const savedTime = parsedState.timestamp;
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      
      if (now - savedTime > TWENTY_FOUR_HOURS) {
        console.log('Saved state expired, clearing old data');
        this.clearState();
        return null;
      }

      console.log('Restoring state from localStorage');
      return parsedState;
    } catch (error) {
      console.error('Failed to restore state:', error);
      this.clearState();
      return null;
    }
  }

  // Clear saved state
  clearState() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('Cleared saved state');
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }

  // Check if there is persisted state
  hasPersistedState() {
    try {
      const savedState = localStorage.getItem(this.STORAGE_KEY);
      return savedState !== null;
    } catch (error) {
      return false;
    }
  }

  // Get basic info about saved state
  getStateInfo() {
    try {
      const savedState = localStorage.getItem(this.STORAGE_KEY);
      if (!savedState) {
        return null;
      }

      const parsedState = JSON.parse(savedState);
      return {
        timestamp: parsedState.timestamp,
        userEmail: parsedState.userEmail,
        storyTitle: parsedState.storyTitle,
        pageCount: parsedState.pageCount,
        hasGeneratedContent: parsedState.hasGeneratedContent
      };
    } catch (error) {
      console.error('Failed to get state info:', error);
      return null;
    }
  }
}

// 单例实例
const stateManager = new StateManager();

export default stateManager; 