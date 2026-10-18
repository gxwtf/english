import { permanentRedirect } from 'next/navigation';

export const metadata = {
  title: '作文积累本 | 广学英语',
};

/**
 * 作文积累本已从「广学英语」独立为单独项目：https://writing.gxwtf.cn
 * 这里保留 308 永久重定向，兼容旧书签与外部链接。
 */
export default function WritingPage(): never {
  permanentRedirect('https://writing.gxwtf.cn/');
}
