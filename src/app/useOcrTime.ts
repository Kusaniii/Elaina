import { useState } from "react";
import Tesseract from "tesseract.js";

function hhmmssToSecs(val: string): number {
  if (!val.trim()) return 0;
  const parts = val.split(":");
  
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

// Chiến thuật mới: Phóng to x2.5 lần và chỉ bắt vùng sáng chói (màu trắng)
function preprocessForWhiteText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Không thể khởi tạo Canvas"));
          return;
        }

        // Tesseract hoạt động tốt nhất khi chiều cao chữ khoảng 30-40px. 
        // Ảnh gốc chữ rất bé, nên bắt buộc phải Upscale lên ít nhất 2.5 lần.
        const scale = 2.5; 
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Bật tính năng làm mượt ảnh khi phóng to
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Tính độ chói (Luminance) của pixel
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          // Chữ thời gian trong UI thường là màu trắng cực sáng (Luma > 220)
          // Đảo ngược màu: Biến chữ trắng thành chữ ĐEN, và biến tất cả nền thành TRẮNG
          // Điều này giúp tạo ra một bức ảnh giống hệt "văn bản tài liệu" cho Tesseract
          if (luma > 220) {
            data[i] = 0;     // Chữ đen
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else {
            data[i] = 255;   // Nền trắng
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Lỗi tải hình ảnh"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Lỗi đọc File"));
    reader.readAsDataURL(file);
  });
}

export function useOcrTime() {
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const processImage = async (file: File): Promise<number[]> => {
    try {
      setIsOcrLoading(true);

      const preprocessedImg = await preprocessForWhiteText(file);

      const result = await Tesseract.recognize(preprocessedImg, "eng", {
        config: {
          tessedit_char_whitelist: "0123456789:",
          // PSM 12: Sparse text with OSD (Phù hợp nhất để tìm các cụm chữ nằm rải rác)
          tessonly_page_seg_mode: "12" as any, 
        }
      });
      
      const rawText = result.data.text;

      // Xử lý các dấu câu Tesseract hay nhận diện nhầm
      const normalizedText = rawText
        .replace(/[;.,|]/g, ":")
        .replace(/\s+/g, " ");

      const rawTokens = normalizedText.split(" ");
      const secondsArray: number[] = [];

      for (const token of rawTokens) {
        const cleanedToken = token.replace(/[^0-9:]/g, "").trim();
        
        // Fix lỗi cụm dạng "::" hoặc ":00"
        if (cleanedToken && cleanedToken.includes(":") && /[0-9]/.test(cleanedToken)) {
          // Bỏ các token có dấu : nằm ở đầu hoặc cuối (ví dụ ":14" hoặc "14:")
          if (cleanedToken.startsWith(":") || cleanedToken.endsWith(":")) continue;

          const parts = cleanedToken.split(":");
          // Thời gian hợp lệ thường không có cụm nào quá 2 số (trừ khi là giờ > 99)
          const isValidFormat = parts.every(p => p.length <= 2) && parts.length >= 2;
          
          if (isValidFormat) {
            const seconds = hhmmssToSecs(cleanedToken);
            secondsArray.push(seconds);
          }
        }
      }

      const uniqueSecondsArray = secondsArray.sort((a, b) => a - b);

      if (uniqueSecondsArray.length === 0) {
        alert("Không tìm thấy mốc thời gian video hợp lệ nào!");
      }

      return uniqueSecondsArray;
    } catch (error) {
      console.error("Lỗi:", error);
      return [];
    } finally {
      setIsOcrLoading(false);
    }
  };

  return { processImage, isOcrLoading };
}