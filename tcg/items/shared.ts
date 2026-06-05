import { ImagePanel, ImagePanelMode } from '../imagePanel';
import { itemImagePath } from '../assetPaths';

export function itemImagePanel(itemId: string, options?: { whiteBackground?: boolean }): ImagePanel {
  return new ImagePanel(itemImagePath(itemId), {
    mode: ImagePanelMode.Background,
    backgroundColor: options?.whiteBackground ? '#ffffff' : 'transparent',
  });
}
