import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface CapturedPhoto {
  file: File;
  dataUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class NativeCameraService {
  /**
   * Whether the device supports native camera capture.
   */
  get isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Take a photo using the device camera.
   */
  async takePhoto(): Promise<CapturedPhoto> {
    return this.getPhoto(CameraSource.Camera);
  }

  /**
   * Pick a photo from the device photo library.
   */
  async pickFromGallery(): Promise<CapturedPhoto> {
    return this.getPhoto(CameraSource.Photos);
  }

  private async getPhoto(source: CameraSource): Promise<CapturedPhoto> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      saveToGallery: false,
    });

    if (!photo.dataUrl) {
      throw new Error('No image data received from camera');
    }

    const blob = this.dataUrlToBlob(photo.dataUrl);
    const extension = photo.format || 'jpeg';
    const fileName = `photo_${Date.now()}.${extension}`;
    const file = new File([blob], fileName, {
      type: `image/${extension}`,
    });

    return { file, dataUrl: photo.dataUrl };
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }
}
