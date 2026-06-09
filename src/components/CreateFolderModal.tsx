import { useState, useEffect } from "react";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { tone } from "../theme/tokens";

// 폴더 생성·이름 수정 겸용 모달.
export function CreateFolderModal({
  open,
  onClose,
  onSubmit,
  initialName = "",
  title = "새 폴더",
  submitLabel = "생성",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  initialName?: string;
  title?: string;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initialName);
  // 열릴 때(또는 대상 폴더가 바뀔 때) 초기값으로 동기화
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn variant="outline" fullWidth onClick={onClose}>취소</Btn>
          <Btn
            fullWidth
            disabled={!name.trim()}
            onClick={() => onSubmit(name.trim())}
          >
            {submitLabel}
          </Btn>
        </>
      }
    >
      <div style={{ fontSize: 11, color: tone.inkMuted, marginBottom: 5, fontWeight: 500 }}>
        폴더 이름
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: 알고리즘"
        autoFocus
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 13,
          background: tone.surface,
          border: `1px solid ${tone.border}`,
          borderRadius: 8,
          fontFamily: "inherit",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </Modal>
  );
}
