import { useState } from "react";
import Tesseract from "tesseract.js";

// Khai báo kiểu dữ liệu trả về cho mỗi hàng
export type ParsedRow = {
  name: string;
  totalTime: string; // Trả về dạng chuỗi "4:03:12"
  rawTimes: string[]; // Mảng chứa các thời gian cộng lẻ tẻ nếu bạn cần dùng
};

// Hàm tiền xử lý: Đảo ngược màu (Invert) biến nền đen chữ trắng thành nền trắng chữ đen
function invertImageColors(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("No canvas context");

        // Phóng to nhẹ để nét chữ rõ hơn
        canvas.width = img.width * 1.5;
        canvas.height = img.height * 1.5;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Quét từng pixel và đảo ngược màu (255 - giá trị hiện tại)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];         // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
          // Alpha (data[i+3]) giữ nguyên
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function parseOcrTextToRows(text: string): ParsedRow[] {
  const lines = text.split("\n");
  const extractedData: ParsedRow[] = [];

  let skipNextLine = false;
  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    raw = raw.replace(/[;.,]/g, ":").replace(/\s+/g, " ").trim();

    // Nếu dòng trước đã kết thúc bằng '=' thì bỏ qua dòng này
    if (skipNextLine) {
      skipNextLine = false;
      continue;
    }

    // Kiểm tra xem dòng hiện tại có kết thúc bằng '=' hay không
    const endsWithEquals = /=$/.test(raw);

    // Nếu có dấu '=' ở giữa dòng, chỉ lấy phần trước '='
    if (raw.includes("=")) {
      raw = raw.split("=")[0].trim();
    }

    // Nếu dòng trống sau khi tách, và dòng gốc kết thúc bằng '=', thì bỏ tiếp dòng sau
    if (!raw) {
      if (endsWithEquals) skipNextLine = true;
      continue;
    }

    const nameMatch = raw.match(/^([a-zA-ZÀ-ỹĐđ\s]+)/);
    const name = nameMatch ? nameMatch[1].trim() : "Không rõ tên";

    // Nếu không tìm được tên rõ ràng thì bỏ qua mục này
    if (!name || name === "Không rõ tên") continue;

    const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
    const times = raw.match(timeRegex);

    if (times && times.length > 0) {
      extractedData.push({
        name,
        totalTime: times[times.length - 1],
        rawTimes: times,
      });
    }
  }

  return extractedData;
}

export function useGlobalOcr() {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const processGlobalImage = async (file: File): Promise<ParsedRow[]> => {
    try {
      setIsGlobalLoading(true);

      const processedImg = await invertImageColors(file);

      const result = await Tesseract.recognize(processedImg, "vie+eng", {
        config: {
          tessedit_pageseg_mode: "6",
        },
      });

      const extractedData = parseOcrTextToRows(result.data.text);

      if (extractedData.length === 0) {
        alert("Không tìm thấy dữ liệu tên và thời gian hợp lệ trong ảnh.");
      }

      return extractedData;
    } catch (error) {
      console.error("Lỗi OCR toàn cục:", error);
      alert("Lỗi khi phân tích ảnh toàn cục.");
      return [];
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const processCropImage = async (dataUrl: string): Promise<ParsedRow[]> => {
    try {
      setIsGlobalLoading(true);

      const result = await Tesseract.recognize(dataUrl, "vie+eng", {
        config: {
          tessedit_pageseg_mode: "6",
        },
      });

      return parseOcrTextToRows(result.data.text);
    } catch (error) {
      console.error("Lỗi OCR khi xử lý ảnh cắt:", error);
      return [];
    } finally {
      setIsGlobalLoading(false);
    }
  };

  return { processGlobalImage, processCropImage, isGlobalLoading };
}