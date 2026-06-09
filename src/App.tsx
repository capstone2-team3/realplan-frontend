// ───────────────────────── App (루트 컴포넌트 / 상태 + 라우팅) ─────────────────────────
// 모든 화면 상태와 데이터(tasks, folders)를 여기서 들고 자식 화면에 내려준다.
// 백엔드 연동 시: initialTasks/initialFolders 를 서버에서 받아오도록 바꾸고,
// 각 handle* 함수 안에서 서버 호출을 추가하면 된다. (src/api/ 참고)
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Home as HomeIcon,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

import type { Screen, Task, Folder, StudyRecord, User, HomeRecommendation } from "./types";
import { tone, fontStack, monoStack } from "./theme/tokens";
import { api } from "./api";

import { PhoneFrame } from "./components/PhoneFrame";
import { TaskFormModal } from "./components/TaskFormModal";
import { CreateFolderModal } from "./components/CreateFolderModal";
import { ManualRecordModal } from "./components/ManualRecordModal";
import { ConfirmDialog } from "./components/ConfirmDialog";

import { HomeScreen } from "./screens/HomeScreen";
import { TasksScreen } from "./screens/TasksScreen";
import { TaskDetailScreen } from "./screens/TaskDetailScreen";
import { StudySessionScreen } from "./screens/StudySessionScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { AuthScreen } from "./screens/AuthScreen";

export default function App() {
  // 인증 상태 (목업: 로그인/회원가입 시 user 세팅)
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  // taskDetail 진입 직전의 탭 화면 추적 (Home에서 들어왔는지 Tasks에서 들어왔는지)
  const [prevTabScreen, setPrevTabScreen] = useState<Screen["name"]>("home");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  // 로그인되면 서버(또는 mock)에서 폴더·태스크를 불러온다.
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    setLoading(true);
    Promise.all([api.fetchFolders(), api.fetchTasks()])
      .then(([f, t]) => {
        if (!alive) return;
        setFolders(f);
        setTasks(t);
      })
      .catch((e) => console.error("초기 데이터 로드 실패:", e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [currentUser]);

  // 태스크 상세 진입 시 학습 기록(세션) 목록을 불러와 해당 태스크에 채운다.
  useEffect(() => {
    if (screen.name !== "taskDetail") return;
    const taskId = screen.taskId;
    let alive = true;
    api.fetchTaskSessions(taskId)
      .then((records) => {
        if (alive) setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, records } : t)));
      })
      .catch((e) => console.error("학습 기록 로드 실패:", e));
    return () => {
      alive = false;
    };
  }, [screen]);

  // Modals
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [defaultFolderForCreate, setDefaultFolderForCreate] = useState("default");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [manualRecordOpen, setManualRecordOpen] = useState(false);
  const [manualRecordTaskId, setManualRecordTaskId] = useState<string | null>(null);
  // 진행 중 타이머 세션
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTaskId, setActiveSessionTaskId] = useState<string | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  // Home state (recommendation only; availability moved into HomeScreen)
  const [recommendation, setRecommendation] = useState<HomeRecommendation | null>(null);

  const navigate = (s: Screen) => {
    // taskDetail로 진입할 때, 현재 화면이 탭 화면이면 그걸 기억
    if (s.name === "taskDetail" && (screen.name === "home" || screen.name === "tasks" || screen.name === "analytics" || screen.name === "settings")) {
      setPrevTabScreen(screen.name);
    }
    setScreen(s);
  };

  const handleCreateOrEditTask = async (
    data: Omit<Task, "id" | "records" | "createdAt">,
    editingId?: string,
  ) => {
    try {
      if (editingId) {
        const updated = await api.updateTask(editingId, data);
        setTasks((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const created = await api.createTask(data);
        setTasks((prev) => [...prev, created]);
      }
    } catch (e) {
      console.error("Task 저장 실패:", e);
    } finally {
      setTaskFormOpen(false);
      setEditingTaskId(null);
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      const folder = await api.createFolder(name);
      setFolders((prev) => [...prev, folder]);
    } catch (e) {
      console.error("폴더 생성 실패:", e);
    } finally {
      setCreateFolderOpen(false);
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      const updated = await api.updateFolder(id, name);
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (e) {
      console.error("폴더 수정 실패:", e);
    } finally {
      setRenameFolderId(null);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api.deleteFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      // 삭제된 폴더의 태스크는 서버에서 기본 폴더로 이동됨 → 로컬도 반영
      const def = folders.find((f) => f.isDefault);
      if (def) {
        setTasks((prev) => prev.map((t) => (t.folderId === id ? { ...t, folderId: def.id } : t)));
      }
    } catch (e) {
      console.error("폴더 삭제 실패:", e);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) {
      console.error("Task 삭제 실패:", e);
    } finally {
      setDeleteConfirmTaskId(null);
      if (screen.name === "taskDetail" && screen.taskId === taskId) {
        setScreen({ name: "tasks" });
      }
    }
  };

  const handleStartSession = async (taskId: string) => {
    try {
      const sessionId = await api.startSession(taskId);
      setActiveSessionId(sessionId);
      setActiveSessionTaskId(taskId);
      setScreen({ name: "studySession", taskId });
    } catch (e) {
      // 이미 ACTIVE/PAUSED 세션이 있으면 400 — 화면 전환하지 않음
      console.error("세션 시작 실패:", e);
    }
  };

  const handlePauseSession = () => {
    if (activeSessionId) api.pauseSession(activeSessionId).catch((e) => console.error("일시정지 실패:", e));
  };
  const handleResumeSession = () => {
    if (activeSessionId) api.resumeSession(activeSessionId).catch((e) => console.error("재개 실패:", e));
  };

  // 종료하지 않고 세션 화면을 벗어날 때: 서버 세션을 무효화하고 상세로 복귀.
  const handleAbandonSession = (taskId: string) => {
    if (activeSessionId) {
      api.abandonSession(activeSessionId).catch((e) => console.error("세션 무효화 실패:", e));
    }
    setActiveSessionId(null);
    setActiveSessionTaskId(null);
    navigate({ name: "taskDetail", taskId });
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const updated = await api.completeTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      console.error("Task 완료 처리 실패:", e);
    }
  };

  const handleEndSession = async (feedback: {
    progressLevel: 1 | 2 | 3 | 4 | 5;
    progressPercent: number;
    focusLevel: 1 | 2 | 3 | 4;
    notes?: string;
  }) => {
    const taskId = activeSessionTaskId;
    try {
      if (activeSessionId) {
        const updated = await api.endSession(activeSessionId, feedback);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (e) {
      console.error("세션 종료 실패:", e);
    } finally {
      setActiveSessionId(null);
      setActiveSessionTaskId(null);
      if (taskId) setScreen({ name: "taskDetail", taskId });
    }
  };

  const handleAddManualRecord = async (
    taskId: string,
    record: Omit<StudyRecord, "id" | "durationMin" | "source">,
  ) => {
    try {
      const updated = await api.addManualRecord(taskId, {
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        progressLevel: record.progressLevel,
        progressPercent: record.progressPercent,
        focusLevel: record.focusLevel,
        notes: record.notes,
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      console.error("수동 기록 저장 실패:", e);
    } finally {
      setManualRecordOpen(false);
      setManualRecordTaskId(null);
    }
  };

  const currentTask =
    screen.name === "taskDetail" || screen.name === "studySession"
      ? tasks.find((t) => t.id === (screen as any).taskId)
      : null;

  const editingTask = editingTaskId ? tasks.find((t) => t.id === editingTaskId) : null;
  const deletingTask = deleteConfirmTaskId ? tasks.find((t) => t.id === deleteConfirmTaskId) : null;

  const showTabBar = ["home", "tasks", "analytics", "settings"].includes(screen.name);

  const tabs: { name: Screen["name"]; icon: React.ReactNode; label: string }[] = [
    { name: "home", icon: <HomeIcon size={19} />, label: "Home" },
    { name: "tasks", icon: <ListTodo size={19} />, label: "Tasks" },
    { name: "analytics", icon: <BarChart3 size={19} />, label: "Analytics" },
    { name: "settings", icon: <SettingsIcon size={19} />, label: "Settings" },
  ];

  return (
    <div style={{ fontFamily: fontStack }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

        * { box-sizing: border-box; }
        html, body, #root { margin: 0; height: 100%; }
        button { font-family: inherit; }
        input, select, textarea { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <PhoneFrame>
        {!currentUser ? (
          <AuthScreen
            onLogin={async (email, password) => {
              const user = await api.login(email, password);
              setCurrentUser(user);
              setScreen({ name: "home" });
            }}
            onSignup={async (name, email, password) => {
              const user = await api.signup(name, email, password);
              setCurrentUser(user);
              setScreen({ name: "home" });
            }}
          />
        ) : (
        <>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {screen.name === "home" && (
              <HomeScreen
                tasks={tasks}
                folders={folders}
                onNavigate={navigate}
                recommendation={recommendation}
                setRecommendation={setRecommendation}
                userName={currentUser.name}
              />
            )}
            {screen.name === "tasks" && (
              <TasksScreen
                tasks={tasks}
                folders={folders}
                onNavigate={navigate}
                onCreateTask={(folderId) => {
                  setDefaultFolderForCreate(folderId);
                  setEditingTaskId(null);
                  setTaskFormOpen(true);
                }}
                onCreateFolder={() => setCreateFolderOpen(true)}
                onEditTask={(taskId) => {
                  setEditingTaskId(taskId);
                  setTaskFormOpen(true);
                }}
                onDeleteTask={(taskId) => setDeleteConfirmTaskId(taskId)}
                onRenameFolder={(folderId) => setRenameFolderId(folderId)}
                onDeleteFolder={(folderId) => handleDeleteFolder(folderId)}
              />
            )}
            {screen.name === "taskDetail" && currentTask && (
              <TaskDetailScreen
                task={currentTask}
                onBack={() => navigate({ name: prevTabScreen } as Screen)}
                onStartSession={() => handleStartSession(currentTask.id)}
                onAddManualRecord={() => {
                  setManualRecordTaskId(currentTask.id);
                  setManualRecordOpen(true);
                }}
                onEditTask={() => {
                  setEditingTaskId(currentTask.id);
                  setTaskFormOpen(true);
                }}
                onCompleteTask={() => handleCompleteTask(currentTask.id)}
              />
            )}
            {screen.name === "studySession" && currentTask && (
              <StudySessionScreen
                task={currentTask}
                onBack={() => handleAbandonSession(currentTask.id)}
                onPause={handlePauseSession}
                onResume={handleResumeSession}
                onEnd={(feedback) => handleEndSession(feedback)}
              />
            )}
            {screen.name === "analytics" && <AnalyticsScreen tasks={tasks} />}
            {screen.name === "settings" && (
              <SettingsScreen
                initialName={currentUser.name}
                initialEmail={currentUser.email}
                onLogout={async () => {
                  try {
                    await api.logout();
                  } finally {
                    setCurrentUser(null);
                    setTasks([]);
                    setFolders([]);
                    setScreen({ name: "home" });
                  }
                }}
                onUpdateProfile={async (nickname, password) => {
                  const u = await api.updateProfile({ nickname, password });
                  // 응답에 email 이 없으면(mock) 기존 email 유지
                  setCurrentUser({ name: u.name, email: u.email || currentUser.email });
                }}
                onResetData={async () => {
                  try {
                    await api.resetData();
                    // 서버는 초기화 후에도 기본 폴더를 유지하므로, 로컬을 비우지 말고
                    // 재로그인과 동일하게 서버 상태를 다시 불러온다. (folders 가 []이면 Tasks 화면이 크래시)
                    const [f, t] = await Promise.all([api.fetchFolders(), api.fetchTasks()]);
                    setFolders(f);
                    setTasks(t);
                  } catch (e) {
                    console.error("데이터 초기화 후 재로드 실패:", e);
                    setTasks([]);
                    setFolders([]);
                  } finally {
                    setScreen({ name: "home" });
                  }
                }}
                onWithdraw={async () => {
                  try {
                    await api.withdraw();
                  } finally {
                    setCurrentUser(null);
                    setTasks([]);
                    setFolders([]);
                    setScreen({ name: "home" });
                  }
                }}
              />
            )}
          </div>

          {showTabBar && (
            <div
              style={{
                display: "flex",
                background: tone.surface,
                borderTop: `1px solid ${tone.border}`,
                padding: "8px 0 14px",
                flexShrink: 0,
              }}
            >
              {tabs.map((t) => {
                const isActive = screen.name === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => navigate({ name: t.name } as Screen)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      padding: "5px 0",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: isActive ? tone.ink : tone.inkSubtle,
                      transition: "color 0.15s",
                    }}
                  >
                    {t.icon}
                    <div style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <TaskFormModal
          open={taskFormOpen}
          onClose={() => {
            setTaskFormOpen(false);
            setEditingTaskId(null);
          }}
          onSubmit={handleCreateOrEditTask}
          folders={folders}
          defaultFolderId={defaultFolderForCreate}
          editingTask={editingTask}
        />

        <CreateFolderModal
          open={createFolderOpen}
          onClose={() => setCreateFolderOpen(false)}
          onSubmit={handleCreateFolder}
        />

        <CreateFolderModal
          open={renameFolderId !== null}
          onClose={() => setRenameFolderId(null)}
          onSubmit={(name) => {
            if (renameFolderId) handleRenameFolder(renameFolderId, name);
          }}
          initialName={folders.find((f) => f.id === renameFolderId)?.name ?? ""}
          title="폴더명 수정"
          submitLabel="저장"
        />

        <ManualRecordModal
          open={manualRecordOpen}
          task={tasks.find((t) => t.id === manualRecordTaskId) ?? null}
          onClose={() => {
            setManualRecordOpen(false);
            setManualRecordTaskId(null);
          }}
          onSave={(rec) => {
            if (manualRecordTaskId) handleAddManualRecord(manualRecordTaskId, rec);
          }}
        />

        <ConfirmDialog
          open={deleteConfirmTaskId !== null}
          title="Task 삭제"
          message={`'${deletingTask?.name ?? ""}' Task를 삭제할까요? 학습 기록도 함께 사라집니다.`}
          confirmLabel="삭제"
          variant="danger"
          onCancel={() => setDeleteConfirmTaskId(null)}
          onConfirm={() => deleteConfirmTaskId && handleDeleteTask(deleteConfirmTaskId)}
        />
        </>
        )}
      </PhoneFrame>
    </div>
  );
}
