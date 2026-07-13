import { useState, useMemo } from 'react'
import { Modal, Upload, Table, Button, Space, Result, Typography, App, Alert } from 'antd'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import { client } from '../api/client'

const { Dragger } = Upload
const { Text } = Typography

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  success_count: number
  fail_count: number
  errors: ImportError[]
}

export interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  title: string
  templateColumns: string[]
  templateUrl: string
  onSuccess: () => void
}

function parseCSV(text: string): string[][] {
  // Start with first row already created — avoids dropping the first field
  const rows: string[][] = [[]]
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      rows[rows.length - 1].push(current.trim())
      current = ''
    } else if (ch === '\n' && !inQuotes) {
      rows[rows.length - 1].push(current.trim())
      rows.push([])
      current = ''
    } else if (ch === '\r' && text[i + 1] === '\n' && !inQuotes) {
      rows[rows.length - 1].push(current.trim())
      rows.push([])
      current = ''
      i++
    } else if (ch === '\r' && !inQuotes) {
      rows[rows.length - 1].push(current.trim())
      rows.push([])
      current = ''
    } else {
      current += ch
    }
  }
  // handle last field
  if (current) {
    rows[rows.length - 1].push(current.trim())
  }
  // Remove empty trailing row (first row is always present, so rows.length > 0 is guaranteed)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop()
  }
  return rows
}

function downloadTemplate(columns: string[]) {
  const csv = '\uFEFF' + columns.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CsvImportModal({
  open,
  onClose,
  title,
  templateColumns,
  templateUrl,
  onSuccess,
}: CsvImportModalProps) {
  const { message } = App.useApp()
  const [file, setFile] = useState<UploadFile | null>(null)
  const [previewData, setPreviewData] = useState<string[][]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleBeforeUpload = (f: UploadFile) => {
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (f.size && f.size > maxSize) {
      message.error('文件大小不能超过 10MB')
      return Upload.LIST_IGNORE
    }
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) {
        const rows = parseCSV(text)
        setPreviewData(rows.slice(0, 6)) // header + 5 rows
      }
    }
    reader.readAsText(f as unknown as File)
    return false // Prevent auto upload
  }

  const handleRemove = () => {
    setFile(null)
    setPreviewData([])
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file as unknown as File)
      const res = await client.post(templateUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = res as unknown as { code: number; data: ImportResult; message: string }
      if (data.code === 0) {
        setResult(data.data)
        if (data.data.fail_count === 0) {
          message.success(`成功导入 ${data.data.success_count} 条记录`)
          onSuccess()
        }
      } else {
        message.error(data.message || '导入失败')
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setUploading(false)
    }
  }

  const previewColumns = useMemo(() => {
    if (previewData.length === 0) return []
    const headers = previewData[0] || []
    return headers.map((h, i) => ({
      title: h,
      dataIndex: i.toString(),
      key: i,
      ellipsis: true,
    }))
  }, [previewData])

  const previewRows = useMemo(() => {
    return previewData.slice(1).map((row, ri) => {
      const obj: Record<string, string> = { key: ri.toString() }
      row.forEach((cell, ci) => {
        obj[ci.toString()] = cell
      })
      return obj
    })
  }, [previewData])

  const handleClose = () => {
    setFile(null)
    setPreviewData([])
    setResult(null)
    onClose()
  }

  const showResult = result !== null

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      width={720}
      footer={
        showResult
          ? [
              <Button key="close" onClick={handleClose}>
                关闭
              </Button>,
              result.fail_count === 0 ? null : (
                <Button
                  key="retry"
                  type="primary"
                  onClick={() => {
                    setResult(null)
                    setFile(null)
                    setPreviewData([])
                  }}
                >
                  重新上传
                </Button>
              ),
            ]
          : [
              <Button key="cancel" onClick={handleClose}>
                取消
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={uploading}
                disabled={!file}
                onClick={handleSubmit}
              >
                开始导入
              </Button>,
            ]
      }
    >
      {!showResult ? (
        <>
          <Alert
            type="info"
            message="CSV 导入说明"
            description={
              <span>
                第一行为表头（自动跳过）。列顺序：{templateColumns.join(', ')}
              </span>
            }
            style={{ marginBottom: 16 }}
            showIcon
          />
          <Space style={{ marginBottom: 16 }}>
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => downloadTemplate(templateColumns)}
            >
              下载模板
            </Button>
          </Space>

          <Dragger
            accept=".csv"
            maxCount={1}
            fileList={file ? [file] : []}
            beforeUpload={handleBeforeUpload}
            onRemove={handleRemove}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 CSV 文件到此处上传</p>
            <p className="ant-upload-hint">仅支持 .csv 格式</p>
          </Dragger>

          {previewRows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                预览（前 {previewRows.length} 行）
              </Text>
              <Table
                size="small"
                columns={previewColumns}
                dataSource={previewRows}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </div>
          )}
        </>
      ) : (
        <Result
          status={result.fail_count === 0 ? 'success' : result.success_count > 0 ? 'warning' : 'error'}
          title={
            result.fail_count === 0
              ? `全部导入成功，共 ${result.success_count} 条`
              : `导入完成：成功 ${result.success_count} 条，失败 ${result.fail_count} 条`
          }
        >
          {result.errors.length > 0 && (
            <Table
              size="small"
              dataSource={result.errors.map((e, i) => ({ ...e, key: i }))}
              pagination={false}
              scroll={{ y: 200 }}
              columns={[
                { title: '行号', dataIndex: 'row', width: 80 },
                { title: '错误信息', dataIndex: 'message' },
              ]}
            />
          )}
        </Result>
      )}
    </Modal>
  )
}
