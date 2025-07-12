import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageViewer from '../../components/ImageViewer';

// Mock data
const mockPages = [
  {
    id: 'page1',
    pageNumber: 1,
    text: 'This is page 1 content',
    image: 'https://example.com/image1.jpg',
    imagePrompt: 'A beautiful landscape'
  },
  {
    id: 'page2',
    pageNumber: 2,
    text: 'This is page 2 content',
    image: 'https://example.com/image2.jpg',
    imagePrompt: 'A sunny day'
  },
  {
    id: 'page3',
    pageNumber: 3,
    text: 'This is page 3 content',
    image: null,
    imagePrompt: 'Waiting for image generation'
  }
];

describe('ImageViewer', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  test('renders when isOpen is true', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    expect(screen.getByText('第1页')).toBeInTheDocument();
    expect(screen.getByText('This is page 1 content')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(
      <ImageViewer
        isOpen={false}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    expect(screen.queryByText('第1页')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    const closeButton = screen.getByTitle('关闭 (ESC)');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('navigates to next page when next button is clicked', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    const nextButton = screen.getByTitle('下一页 (→)');
    fireEvent.click(nextButton);

    expect(screen.getByText('第2页')).toBeInTheDocument();
    expect(screen.getByText('This is page 2 content')).toBeInTheDocument();
  });

  test('navigates to previous page when previous button is clicked', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={1}
        aspectRatio="1:1"
      />
    );

    const prevButton = screen.getByTitle('上一页 (←)');
    fireEvent.click(prevButton);

    expect(screen.getByText('第1页')).toBeInTheDocument();
    expect(screen.getByText('This is page 1 content')).toBeInTheDocument();
  });

  test('handles keyboard navigation', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    const viewer = screen.getByText('第1页').closest('.image-viewer-overlay');
    
    // Test right arrow key
    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(screen.getByText('第2页')).toBeInTheDocument();

    // Test left arrow key
    fireEvent.keyDown(viewer, { key: 'ArrowLeft' });
    expect(screen.getByText('第1页')).toBeInTheDocument();

    // Test escape key
    fireEvent.keyDown(viewer, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('shows no image message when image is null', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={2}
        aspectRatio="1:1"
      />
    );

    expect(screen.getByText('暂无图片')).toBeInTheDocument();
    expect(screen.getByText('Waiting for image generation')).toBeInTheDocument();
  });

  test('shows page indicator', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  test('shows fullscreen hint', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    expect(screen.getByText('双击进入全屏')).toBeInTheDocument();
  });

  test('does not show previous button on first page', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="1:1"
      />
    );

    expect(screen.queryByTitle('上一页 (←)')).not.toBeInTheDocument();
  });

  test('does not show next button on last page', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={2}
        aspectRatio="1:1"
      />
    );

    expect(screen.queryByTitle('下一页 (→)')).not.toBeInTheDocument();
  });

  test('applies landscape layout for horizontal aspect ratio', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="16:9"
      />
    );

    const viewerContent = screen.getByText('This is page 1 content').closest('.viewer-content');
    expect(viewerContent).toHaveClass('landscape');
  });

  test('applies portrait layout for vertical aspect ratio', () => {
    render(
      <ImageViewer
        isOpen={true}
        onClose={mockOnClose}
        pages={mockPages}
        initialPageIndex={0}
        aspectRatio="9:16"
      />
    );

    const viewerContent = screen.getByText('This is page 1 content').closest('.viewer-content');
    expect(viewerContent).toHaveClass('portrait');
  });
}); 