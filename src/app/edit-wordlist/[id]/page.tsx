// app/page.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// 组件导入
import { AlertMessage } from './components/AlertMessage';
import { ConfirmDialog } from './components/ConfirmDialog';
import { AddWordDialog } from './components/AddWordDialog';
import { WordItem } from './components/WordItem';
import { BatchActionsBar } from './components/BatchActionsBar';
import { TagsDescription } from './components/TagsDescription';
import { EmptyState } from './components/EmptyState';

// 类型和常量导入
import { WORD_TAGS } from '@/constants/word-tags';
import { Word, WordTag } from '@/types/word';

// 初始化数据
const initialWords: Word[] = [
	{ id: 1, text: 'run', tags: ['FORMS'] },
	{ id: 2, text: 'set', tags: ['MULTIPLE', 'FORMS'] },
	{ id: 3, text: 'break', tags: ['MULTIPLE'] },
	{ id: 4, text: 'light', tags: ['FORMS'] },
];

const WordListEditor: React.FC = () => {
	// 状态管理
	const [words, setWords] = useState<Word[]>(initialWords);
	const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
	const [selectAll, setSelectAll] = useState(false);
	const [showAddWordDialog, setShowAddWordDialog] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [successAlert, setSuccessAlert] = useState<{
		show: boolean;
		message: string;
	}>({ show: false, message: '' });
	const [wordListName, setWordListName] = useState('');
	const params = useParams();

	// 计算选中的单词数量
	const selectedCount = useMemo(() => selectedWordIds.length, [selectedWordIds]);

	// 获取单词表 ID
	useEffect(() => {
		setWordListName(params.id as string);
	}, [params.id]);

	// 处理成功提示
	useEffect(() => {
		if (successAlert.show) {
			const timer = setTimeout(() => {
				setSuccessAlert({ show: false, message: '' });
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [successAlert.show]);

	// 检查单词是否已存在
	const isWordExists = useCallback((wordText: string) => {
		return words.some(
			word => word.text.toLowerCase() === wordText.toLowerCase().trim()
		);
	}, [words]);

	// 处理添加新单词
	const handleAddWord = useCallback((newWordItem: Omit<Word, 'id'>) => {
		const wordWithId: Word = {
			...newWordItem,
			id: Date.now()
		};

		setWords(prev => [wordWithId, ...prev]);

		setSuccessAlert({
			show: true,
			message: `单词 "${newWordItem.text}" 添加成功！`
		});
	}, []);

	// 处理单个单词选择
	const handleToggleWordSelect = useCallback((wordId: number) => {
		setSelectedWordIds(prev => {
			if (prev.includes(wordId)) {
				return prev.filter(id => id !== wordId);
			} else {
				return [...prev, wordId];
			}
		});
	}, []);

	// 处理全选/取消全选
	const handleSelectAll = useCallback(() => {
		if (selectAll) {
			setSelectedWordIds([]);
		} else {
			setSelectedWordIds(words.map(word => word.id));
		}
		setSelectAll(!selectAll);
	}, [selectAll, words]);

	// 处理删除选中的单词
	const handleDeleteSelected = useCallback(() => {
		if (selectedWordIds.length === 0) return;
		setShowDeleteConfirm(true);
	}, [selectedWordIds]);

	// 确认删除
	const handleConfirmDelete = useCallback(() => {
		setWords(prev => prev.filter(word => !selectedWordIds.includes(word.id)));
		setSelectedWordIds([]);
		setSelectAll(false);
		setShowDeleteConfirm(false);
	}, [selectedWordIds]);

	// 处理单个单词删除
	const handleDeleteWord = useCallback((wordId: number) => {
		setWords(prev => prev.filter(word => word.id !== wordId));
		setSelectedWordIds(prev => prev.filter(id => id !== wordId));
	}, []);

	// 处理测试按钮点击
	const handleTestClick = useCallback(() => {
		console.log('测试功能被点击');
		console.log('选中的单词ID:', selectedWordIds);
		console.log('选中的单词:', words.filter(word => selectedWordIds.includes(word.id)));

		// 这里可以添加测试功能的具体逻辑
		alert(`测试功能：当前选中了 ${selectedCount} 个单词`);
	}, [selectedWordIds, selectedCount, words]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
			<div className="max-w-2xl mx-auto">
				{/* 添加单词对话框 */}
				<AddWordDialog
					isOpen={showAddWordDialog}
					onAddWord={handleAddWord}
					onCancel={() => setShowAddWordDialog(false)}
					onDuplicateCheck={isWordExists}
				/>

				{/* 删除确认对话框 */}
				<ConfirmDialog
					isOpen={showDeleteConfirm}
					title="确认删除"
					message={`您确定要删除选中的 ${selectedCount} 个单词吗？此操作不可撤销。`}
					confirmText="确认删除"
					cancelText="取消"
					onConfirm={handleConfirmDelete}
					onCancel={() => setShowDeleteConfirm(false)}
				/>

				{/* 成功提示 */}
				{successAlert.show && (
					<AlertMessage
						message={successAlert.message}
						type="warning"
						onClose={() => setSuccessAlert({ show: false, message: '' })}
					/>
				)}

				{/* 标题区域 */}
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						编辑单词本
					</h1>
					<p className="text-gray-600">
						高效管理您的英语词汇库
					</p>
				</div>

				<Card className="shadow-lg border-gray-200">
					<CardHeader className="pb-4 border-b border-gray-100">
						<div className="flex justify-between items-start">
							<div>
								<CardTitle className="text-xl font-semibold text-gray-800">
									单词管理
								</CardTitle>
								<CardDescription className="text-gray-500">
									点击"添加单词"按钮创建新单词，或管理现有单词
								</CardDescription>
							</div>

							<Button
								onClick={() => setShowAddWordDialog(true)}
								className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300 px-4 py-2 h-auto"
							>
								<Plus className="h-4 w-4 mr-2" />
								添加新单词
							</Button>
						</div>
					</CardHeader>


					<CardContent className="space-y-6 pt-6">

						{/* 批量操作控制区域 */}
						<BatchActionsBar
							selectedCount={selectedCount}
							selectAll={selectAll}
							onSelectAll={handleSelectAll}
							onDeleteSelected={handleDeleteSelected}
							onTest={handleTestClick}
						/>

						{/* 单词列表 */}
						<div>
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-semibold text-gray-800">
									单词列表
								</h3>
								<div className="text-sm text-gray-500">
									总计: {words.length} 个单词
								</div>
							</div>

							{words.length > 0 ? (
								<div className="space-y-3">
									{words.map((word) => (
										<WordItem
											key={word.id}
											word={word}
											isSelected={selectedWordIds.includes(word.id)}
											onToggleSelect={handleToggleWordSelect}
											onDelete={handleDeleteWord}
											tagsConfig={WORD_TAGS}
										/>
									))}
								</div>
							) : (
								<EmptyState onAddClick={() => setShowAddWordDialog(true)} />
							)}
						</div>
					</CardContent>
				</Card>

				{/* 标签说明区域 */}
				<TagsDescription tags={WORD_TAGS} />
			</div>

			{/* 添加CSS动画 */}
			<style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
		</div>
	);
};

export default WordListEditor;