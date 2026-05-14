import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Drawer, Empty, Form, Input, InputNumber, Modal, Select,
  Space, Table, Tag, Typography, message, Popconfirm, Badge, Tooltip, Upload,
} from 'antd';
import {
  DatabaseOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, EyeOutlined, FileAddOutlined, DownloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { goldenDatasetApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface DatasetItem {
  id: number;
  dataset_id: number;
  question: string;
  expected_answer: string;
  category?: string;
  priority: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

interface Dataset {
  id: number;
  name: string;
  description?: string;
  tags?: string[];
  item_count: number;
  items: DatasetItem[];
  created_at: string;
  updated_at?: string;
}

const priorityMap: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高' },
  medium: { color: 'orange', label: '中' },
  low: { color: 'green', label: '低' },
};

const GoldenDatasets: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<DatasetItem | null>(null);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [datasetForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [editItemForm] = Form.useForm();
  const [importUploading, setImportUploading] = useState(false);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await goldenDatasetApi.list({ keyword, limit: 100 });
      setDatasets(res?.items || []);
    } catch {
      message.error('加载黄金测试集失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => { loadDatasets(); }, [loadDatasets]);

  const handleCreateOrEdit = async () => {
    try {
      const values = await datasetForm.validateFields();
      if (editingDataset) {
        await goldenDatasetApi.update(editingDataset.id, values);
        message.success('测试集已更新');
      } else {
        await goldenDatasetApi.create(values);
        message.success('测试集已创建');
      }
      setCreateModalVisible(false);
      setEditingDataset(null);
      loadDatasets();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await goldenDatasetApi.delete(id);
      message.success('已删除');
      loadDatasets();
      if (activeDataset?.id === id) {
        setActiveDataset(null);
        setDetailDrawerVisible(false);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const data = await goldenDatasetApi.get(id);
      setActiveDataset(data);
      setDetailDrawerVisible(true);
    } catch {
      message.error('加载详情失败');
    }
  };

  const handleAddItems = async () => {
    try {
      const values = await itemForm.validateFields();
      const items = (values.items || []).filter((i: any) => i?.question?.trim());
      if (!items.length) { message.warning('请至少填写一条'); return; }
      await goldenDatasetApi.addItems(activeDataset!.id, items);
      message.success(`已添加 ${items.length} 条`);
      setAddItemModalVisible(false);
      itemForm.resetFields();
      handleViewDetail(activeDataset!.id);
      loadDatasets();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('添加失败');
    }
  };

  const handleEditItem = async () => {
    try {
      const values = await editItemForm.validateFields();
      await goldenDatasetApi.updateItem(editingItem!.id, values);
      message.success('条目已更新');
      setEditItemModalVisible(false);
      handleViewDetail(activeDataset!.id);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('更新失败');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await goldenDatasetApi.deleteItem(itemId);
      message.success('条目已删除');
      handleViewDetail(activeDataset!.id);
      loadDatasets();
    } catch {
      message.error('删除失败');
    }
  };

  const openCreate = () => {
    setEditingDataset(null);
    datasetForm.resetFields();
    setCreateModalVisible(true);
  };

  const openEdit = (ds: Dataset) => {
    setEditingDataset(ds);
    datasetForm.setFieldsValue({ name: ds.name, description: ds.description, tags: ds.tags });
    setCreateModalVisible(true);
  };

  const handleImportExcel = async (file: File) => {
    if (!activeDataset) { message.warning('请先打开一个测试集'); return; }
    setImportUploading(true);
    try {
      const res = await goldenDatasetApi.importExcel(activeDataset.id, file);
      message.success(res.message || `成功导入 ${res.imported_count} 条`);
      if (res.errors?.length) {
        message.warning(`${res.error_count} 行存在问题: ${res.errors.join('; ')}`);
      }
      handleViewDetail(activeDataset.id);
      loadDatasets();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '导入失败');
    } finally {
      setImportUploading(false);
    }
  };

  const datasetColumns: ColumnsType<Dataset> = [
    { title: '名称', dataIndex: 'name', width: 200, ellipsis: true,
      render: (text, record) => (
        <Button type="link" onClick={() => handleViewDetail(record.id)} style={{ padding: 0 }}>{text}</Button>
      ),
    },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: (t) => t || '-' },
    { title: '条目数', dataIndex: 'item_count', width: 90,
      render: (v) => <Badge count={v} showZero style={{ backgroundColor: v > 0 ? '#1677ff' : '#d9d9d9' }} />,
    },
    { title: '标签', dataIndex: 'tags', width: 200,
      render: (tags: string[]) => tags?.length ? tags.map(t => <Tag key={t}>{t}</Tag>) : '-',
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 170,
      render: (t) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    { title: '操作', width: 120, align: 'center' as const,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除此测试集？" okType="danger" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnsType<DatasetItem> = [
    { title: '#', width: 50, render: (_, __, i) => i + 1 },
    { title: '问题', dataIndex: 'question', width: 280, ellipsis: true },
    { title: '期望答案', dataIndex: 'expected_answer', ellipsis: true },
    { title: '分类', dataIndex: 'category', width: 100, render: (t) => t || '-' },
    { title: '优先级', dataIndex: 'priority', width: 80,
      render: (p) => { const m = priorityMap[p]; return m ? <Tag color={m.color}>{m.label}</Tag> : p; },
    },
    { title: '操作', width: 120,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingItem(record);
            editItemForm.setFieldsValue(record);
            setEditItemModalVisible(true);
          }}>编辑</Button>
          <Popconfirm title="确认删除？" okType="danger" onConfirm={() => handleDeleteItem(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}><DatabaseOutlined /> 黄金测试集</Title>
            <Text type="secondary">管理 Agent 评测使用的标准问答数据集（Q&A），作为评测基准</Text>
          </div>
          <Space>
            <Input.Search placeholder="搜索测试集" value={keyword} onChange={e => setKeyword(e.target.value)}
              onSearch={loadDatasets} style={{ width: 200 }} allowClear />
            <Button icon={<ReloadOutlined />} onClick={loadDatasets} loading={loading}>刷新</Button>
            <Button icon={<DownloadOutlined />} onClick={async () => {
              try { await goldenDatasetApi.downloadTemplate(); } catch { message.error('模板下载失败'); }
            }}>下载模板</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建测试集</Button>
          </Space>
        </div>
        <Card bordered={false}>
          <Table rowKey="id" columns={datasetColumns} dataSource={datasets} loading={loading}
            pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="暂无黄金测试集" /> }} />
        </Card>
      </Space>

      {/* 新建/编辑测试集 */}
      <Modal title={editingDataset ? '编辑测试集' : '新建黄金测试集'} open={createModalVisible}
        onOk={handleCreateOrEdit} onCancel={() => setCreateModalVisible(false)} destroyOnClose width={560}>
        <Form form={datasetForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：客服场景标准问答集" maxLength={150} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="测试集的用途和覆盖范围" maxLength={2000} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入后回车添加标签" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试集详情 Drawer */}
      <Drawer title={`测试集详情 — ${activeDataset?.name || ''}`} open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)} width={960} extra={
          <Space>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={(file) => { handleImportExcel(file as unknown as File); return false; }}
            >
              <Button icon={<UploadOutlined />} loading={importUploading}>Excel 导入</Button>
            </Upload>
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => {
              itemForm.resetFields();
              itemForm.setFieldsValue({ items: [{ question: '', expected_answer: '', priority: 'medium' }] });
              setAddItemModalVisible(true);
            }}>手动添加</Button>
          </Space>
        }>
        {activeDataset && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={4}>
                <Text><strong>名称：</strong>{activeDataset.name}</Text>
                <Text><strong>描述：</strong>{activeDataset.description || '无'}</Text>
                <Text><strong>条目数：</strong>{activeDataset.items?.length || 0}</Text>
                {activeDataset.tags?.length ? (
                  <Space><strong>标签：</strong>{activeDataset.tags.map(t => <Tag key={t}>{t}</Tag>)}</Space>
                ) : null}
              </Space>
            </Card>
            <Table rowKey="id" columns={itemColumns} dataSource={activeDataset.items || []}
              pagination={{ pageSize: 10 }} size="middle" />
          </Space>
        )}
      </Drawer>

      {/* 批量添加条目 Modal */}
      <Modal title="添加测试条目" open={addItemModalVisible} onOk={handleAddItems}
        onCancel={() => setAddItemModalVisible(false)} width={720} destroyOnClose>
        <Form form={itemForm} layout="vertical">
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field, index) => (
                  <div key={field.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text strong>条目 {index + 1}</Text>
                      {fields.length > 1 && (
                        <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      )}
                    </div>
                    <Form.Item {...field} name={[field.name, 'question']}
                      rules={[{ required: true, message: '请输入问题' }]} style={{ marginBottom: 8 }}>
                      <TextArea rows={2} placeholder="问题" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'expected_answer']}
                      rules={[{ required: true, message: '请输入期望答案' }]} style={{ marginBottom: 8 }}>
                      <TextArea rows={2} placeholder="期望答案（标准答案）" />
                    </Form.Item>
                    <Space>
                      <Form.Item {...field} name={[field.name, 'category']} style={{ marginBottom: 0 }}>
                        <Input placeholder="分类（可选）" style={{ width: 150 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'priority']} style={{ marginBottom: 0 }} initialValue="medium">
                        <Select style={{ width: 100 }}>
                          <Select.Option value="high">高</Select.Option>
                          <Select.Option value="medium">中</Select.Option>
                          <Select.Option value="low">低</Select.Option>
                        </Select>
                      </Form.Item>
                    </Space>
                  </div>
                ))}
                <Button block icon={<PlusOutlined />} onClick={() => add({ question: '', expected_answer: '', priority: 'medium' })}>
                  添加条目
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 编辑单条条目 Modal */}
      <Modal title="编辑条目" open={editItemModalVisible} onOk={handleEditItem}
        onCancel={() => setEditItemModalVisible(false)} destroyOnClose>
        <Form form={editItemForm} layout="vertical">
          <Form.Item name="question" label="问题" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="expected_answer" label="期望答案" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GoldenDatasets;
