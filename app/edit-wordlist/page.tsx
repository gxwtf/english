"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Plus,
    Trash2,
    CircleQuestionMark,
    Tag,
    Layers,
    CheckCircle,
    XCircle,
    AlertCircle,
    AlertTriangle,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// 类型定义
interface Word {
    id: number;
    text: string;
    tags: WordTag[];
}

type WordTag = "COMMON" | "MULTIPLE" | "FORMS";

interface TagConfig {
    id: string;
    name: string;
    color: string;
    icon: React.ReactNode;
    description: string;
}

// 单词标签配置
const WORD_TAGS: Record<WordTag, TagConfig> = {
    COMMON: {
        id: 'COMMON',
        name: '常用义',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <CircleQuestionMark className="h-3.5 w-3.5" />,
        description: '最常用的单词含义'
    },
    MULTIPLE: {
        id: 'MULTIPLE',
        name: '一词多义',
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <Layers className="h-3.5 w-3.5" />,
        description: '该单词具有多个不同的含义或用法'
    },
    FORMS: {
        id: 'FORMS',
        name: '形式变形',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Tag className="h-3.5 w-3.5" />,
        description: '该单词存在时态、单复数等形态变化'
    }
};

// 警告消息组件
interface AlertMessageProps {
    message: string;
    type: 'warning' | 'error';
    onClose: () => void;
}

const AlertMessage: React.FC<AlertMessageProps> = ({ message, type, onClose }) => {
    return (
        <div className={`
      fixed top-6 left-1/2 transform -translate-x-1/2 z-50
      flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg border animate-slideDown
      ${type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }
    `}>
            {type === 'warning' ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="font-medium">{message}</span>
            <button
                onClick={onClose}
                className="ml-4 p-1 rounded-full hover:bg-white/30 transition-colors"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};

// 确认对话框组件
interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = '确认删除',
    cancelText = '取消',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* 背景遮罩 */}
            <div
                className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* 对话框 */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform animate-scaleIn">
                    <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="mt-1 flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                    {title}
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={onCancel}
                            className="border-gray-300 hover:bg-gray-100"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={onConfirm}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};

// 单词项组件
interface WordItemProps {
    word: Word;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onDelete: (id: number) => void;
}

const WordItem: React.FC<WordItemProps> = ({
    word,
    isSelected,
    onToggleSelect,
    onDelete
}) => {
    return (
        <div className={`
      flex items-center justify-between p-4 rounded-lg border transition-all duration-200
      ${isSelected
                ? 'bg-blue-50 border-blue-300 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }
    `}>
            <div className="flex items-center gap-4 flex-1">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(word.id)}
                    className="h-5 w-5 data-[state=checked]:bg-blue-600"
                />

                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-gray-800">{word.text}</span>
                        {isSelected && (
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                    </div>

                    <div className="flex gap-2 mt-2">
                        {word.tags.length > 0 ? (
                            word.tags.map(tag => {
                                const tagConfig = WORD_TAGS[tag];
                                return (
                                    <Badge
                                        key={tag}
                                        variant="outline"
                                        className={`px-2 py-1 text-xs font-medium ${tagConfig.color}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {tagConfig.icon}
                                            {tagConfig.name}
                                        </div>
                                    </Badge>
                                );
                            })
                        ) : (
                            <span className="text-xs text-gray-400 italic">无标签</span>
                        )}
                    </div>
                </div>
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(word.id)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

// 标签选择器组件
interface TagSelectorProps {
    tagKey: WordTag;
    isSelected: boolean;
    onToggle: (tag: WordTag) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({
    tagKey,
    isSelected,
    onToggle
}) => {
    const tagConfig = WORD_TAGS[tagKey];

    return (
        <button
            type="button"
            onClick={() => onToggle(tagKey)}
            className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
        ${isSelected
                    ? `${tagConfig.color} border-blue-300`
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800'
                }
      `}
        >
            <div className={`p-1 rounded-md ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                {tagConfig.icon}
            </div>
            <span className="text-sm font-medium">{tagConfig.name}</span>
        </button>
    );
};

// 主组件
const WordListEditor: React.FC = () => {
    // 状态管理
    const [words, setWords] = useState<Word[]>([
        { id: 1, text: 'run', tags: ['FORMS'] },
        { id: 2, text: 'set', tags: ['MULTIPLE', 'FORMS'] },
        { id: 3, text: 'break', tags: ['MULTIPLE'] },
        { id: 4, text: 'light', tags: ['FORMS'] },
    ]);

    const [newWord, setNewWord] = useState('');
    const [selectedTags, setSelectedTags] = useState<Record<WordTag, boolean>>({
        COMMON: true,
        MULTIPLE: false,
        FORMS: false
    });
    const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
    const [selectAll, setSelectAll] = useState(false);

    // 新增：重复单词警告状态
    const [duplicateAlert, setDuplicateAlert] = useState<{
        show: boolean;
        message: string;
    }>({ show: false, message: '' });

    // 新增：删除确认对话框状态
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // 计算选中的单词数量
    const selectedCount = useMemo(() => selectedWordIds.length, [selectedWordIds]);

    // 处理重复单词警告
    useEffect(() => {
        if (duplicateAlert.show) {
            const timer = setTimeout(() => {
                setDuplicateAlert({ show: false, message: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [duplicateAlert.show]);

    // 检查单词是否已存在
    const isWordExists = useCallback((wordText: string) => {
        return words.some(
            word => word.text.toLowerCase() === wordText.toLowerCase().trim()
        );
    }, [words]);

    // 处理添加新单词
    const handleAddWord = useCallback(() => {
        if (!newWord.trim()) return;

        const wordText = newWord.trim();

        // 检查是否已存在
        if (isWordExists(wordText)) {
            setDuplicateAlert({
                show: true,
                message: `单词 "${wordText}" 已存在，请勿重复添加`
            });
            return;
        }

        const newWordItem: Word = {
            id: Date.now(),
            text: wordText,
            tags: (Object.keys(selectedTags) as WordTag[]).filter(tag => selectedTags[tag])
        };

        setWords(prev => [newWordItem, ...prev]);
        setNewWord('');
        setSelectedTags({
            COMMON: true,
            MULTIPLE: false,
            FORMS: false
        });
    }, [newWord, selectedTags, isWordExists]);

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

        // 打开确认对话框
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

    // 处理标签选择
    const handleTagToggle = useCallback((tag: WordTag) => {
        setSelectedTags(prev => ({
            ...prev,
            [tag]: !prev[tag]
        }));
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* 重复单词警告 */}
                {duplicateAlert.show && (
                    <AlertMessage
                        message={duplicateAlert.message}
                        type="warning"
                        onClose={() => setDuplicateAlert({ show: false, message: '' })}
                    />
                )}

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

                {/* 标题区域 */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        单词列表编辑器
                    </h1>
                    <p className="text-gray-600">
                        高效管理您的英语词汇库
                    </p>
                </div>

                <Card className="shadow-lg border-gray-200">
                    <CardHeader className="pb-4 border-b border-gray-100">
                        <CardTitle className="text-xl font-semibold text-gray-800">
                            添加新单词
                        </CardTitle>
                        <CardDescription className="text-gray-500">
                            输入单词并选择需要重点关注的标签
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6">
                        {/* 添加单词区域 */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-word" className="text-sm font-medium text-gray-700">
                                    单词
                                </Label>
                                <div className="flex gap-3">
                                    <Input
                                        id="new-word"
                                        placeholder="请输入一个英语单词..."
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleAddWord}
                                        disabled={!newWord.trim()}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        添加
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    选择知识点标签
                                </Label>
                                <p className="text-xs text-gray-500">
                                    请认真选择以提高背诵效率
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {(Object.keys(WORD_TAGS) as WordTag[]).map((tagKey) => (
                                        <TagSelector
                                            key={tagKey}
                                            tagKey={tagKey}
                                            isSelected={selectedTags[tagKey]}
                                            onToggle={handleTagToggle}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 批量操作控制区域 */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="select-all"
                                        checked={selectAll}
                                        onCheckedChange={handleSelectAll}
                                        className="h-5 w-5 data-[state=checked]:bg-blue-600"
                                    />
                                    <Label
                                        htmlFor="select-all"
                                        className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                                    >
                                        {selectAll ? '取消全选' : '全选'}
                                    </Label>
                                </div>

                                {selectedCount > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                                        <CheckCircle className="h-4 w-4" />
                                        已选择 {selectedCount} 个单词
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handleDeleteSelected}
                                disabled={selectedCount === 0}
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                删除选中
                            </Button>
                        </div>

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
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
                                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                        <XCircle className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 mb-1 font-medium">暂无单词</p>
                                    <p className="text-gray-400 text-sm">添加您的第一个单词开始学习</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 标签说明区域 */}
                <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3">标签说明</h4>
                    <div className="space-y-3">
                        {Object.values(WORD_TAGS).map((tag) => (
                            <div key={tag.id} className="flex items-start gap-3">
                                <Badge variant="outline" className={`px-3 py-1 ${tag.color}`}>
                                    <div className="flex items-center gap-2">
                                        {tag.icon}
                                        {tag.name}
                                    </div>
                                </Badge>
                                <span className="text-sm text-gray-600 flex-1">
                                    {tag.description}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
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