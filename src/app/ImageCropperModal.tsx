import { useState, useRef } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check } from "lucide-react";

type ImageCropperModalProps = {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
};

export default function ImageCropperModal({ imageSrc, onClose, onCropComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Biến kiểm tra xem người dùng đã thực hiện thao tác kéo thả chọn vùng hay chưa
  // Thỏa mãn khi có vùng chọn diện tích lớn hơn 0
  const hasCropArea = completedCrop && completedCrop.width > 0 && completedCrop.height > 0;

  // Hàm sinh ra file ảnh mới từ vùng được chọn hoặc lấy toàn bộ ảnh
  const handleConfirmCrop = async () => {
    if (!imageRef.current) return;

    const image = imageRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // TRƯỜNG HỢP 1: Có tương tác kéo thả vùng chọn hợp lệ -> Tiến hành cắt ảnh theo tọa độ vùng chọn
    if (hasCropArea && completedCrop) {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );
    } 
    // TRƯỜNG HỢP 2: Không thao tác (vùng crop trống) -> Sử dụng toàn bộ hình ảnh gốc ban đầu
    else {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
    }

    // Chuyển đổi canvas thành file blob và gửi ra ngoài cho hàm processImage của OCR
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], "cropped_image.png", { type: "image/png" });
      onCropComplete(croppedFile);
    }, "image/png");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
          <div>
            <span className="font-semibold text-sm block text-foreground">Cắt vùng ảnh chứa mốc thời gian</span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              {hasCropArea 
                ? "Hệ thống sẽ cắt chính xác vùng bạn đã chọn" 
                : "Mặc định: Bấm Xác nhận để quét TOÀN BỘ bức ảnh gốc"
              }
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        
        {/* Vùng chứa khung Crop */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 min-h-[300px]">
          <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
            <img 
              ref={imageRef} 
              src={imageSrc} 
              alt="Crop source" 
              className="max-h-[60vh] object-contain select-none" 
              draggable={false}
            />
          </ReactCrop>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2 bg-muted/40">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded-md transition-colors text-foreground">
            Hủy
          </button>
          <button 
            onClick={handleConfirmCrop} 
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity shadow-sm"
          >
            <Check size={14} /> 
            {hasCropArea ? "Cắt vùng chọn & Quét" : "Quét toàn bộ ảnh"}
          </button>
        </div>
      </div>
    </div>
  );
}