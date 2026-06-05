import { useState } from "react";
import { Btn } from "./Btn";
import { Modal } from "./Modal";
import { tone } from "../theme/tokens";

export function CreateFolderModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 폴더"
      footer={
        <>
          <Btn variant="outline" fullWidth onClick={onClose}>취소</Btn>
          <Btn
            fullWidth
            disabled={!name.trim()}
            onClick={() => {
              onCreate(name.trim());
              setName("");
            }}
          >
            생성
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
