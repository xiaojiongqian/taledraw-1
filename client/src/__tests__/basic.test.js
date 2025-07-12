// Basic test to verify setup
describe('Test Environment', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to test globals', () => {
    expect(global.localStorage).toBeDefined();
    expect(global.window).toBeDefined();
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('should mock console methods', () => {
    console.log('test');
    expect(console.log).toHaveBeenCalledWith('test');
  });
});