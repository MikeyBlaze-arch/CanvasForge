import React, { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { CanvasRoot } from '../canvas/CanvasRoot'
import { FloatingProjectBar } from './floating/FloatingProjectBar'
import { FloatingLeftToolbar } from './floating/FloatingLeftToolbar'
import { FloatingTopRightActions } from './floating/FloatingTopRightActions'
import { FloatingBottomControls } from './floating/FloatingBottomControls'
import { FloatingAddNodeMenu } from './floating/FloatingAddNodeMenu'
import { FloatingPanelDrawer } from './floating/FloatingPanelDrawer'
import { ApiSettingsModal } from './floating/ApiSettingsModal'
import { useProjectStore } from '../store/projectStore'
import { loadLatestProject, deserializeProject } from '../persistence/projectSerializer'
import { useUIStore, type PendingGroupDialog } from '../store/uiStore'
import { createGroupFromDialog } from '../store/nodeStore'
import { NameDialog } from '../components/NameDialog'
import { useI18n } from '../i18n/useI18n'

function GroupNameDialog() {
  const dialog = useUIStore((s) => s.pendingGroupDialog)
  const closeGroupDialog = useUIStore((s) => s.closeGroupDialog)
  const { t } = useI18n()

  const handleConfirm = (rawName: string) => {
    const title = rawName.trim() || t('group.untitled')

    if (dialog.open) {
      if (dialog.mode === 'empty') {
        createGroupFromDialog({
          title,
          position: dialog.position,
        })
      } else if (dialog.mode === 'selection') {
        createGroupFromDialog({
          title,
          nodeIds: dialog.nodeIds,
          bounds: dialog.bounds,
        })
      }
    }
    closeGroupDialog()
  }

  const handleCancel = () => {
    closeGroupDialog()
  }

  return (
    <NameDialog
      open={dialog.open}
      title={t('group.new')}
      placeholder={t('group.namePlaceholder')}
      confirmText={t('common.create')}
      cancelText={t('common.cancel')}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )
}

function AppShellInner() {
  const createProject = useProjectStore((s) => s.createProject)

  useEffect(() => {
    loadLatestProject().then((project) => {
      if (project) {
        deserializeProject(project)
      } else {
        createProject()
      }
    }).catch(() => {
      createProject()
    })
  }, [])

  return (
    <div className="app-layout">
      <CanvasRoot />
      <FloatingProjectBar />
      <FloatingLeftToolbar />
      <FloatingTopRightActions />
      <FloatingBottomControls />
      <FloatingAddNodeMenu />
      <FloatingPanelDrawer />
      <ApiSettingsModal />
      <GroupNameDialog />
    </div>
  )
}

export function AppShell() {
  return (
    <ReactFlowProvider>
      <AppShellInner />
    </ReactFlowProvider>
  )
}
