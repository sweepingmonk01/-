import React from 'react';
import { motion } from 'motion/react';
import { Github, Code2, Lock, Globe } from 'lucide-react';

const FACTS = [
  {
    icon: Code2,
    label: '核心引擎开源',
    detail: 'AI Active 认知引擎、Mobius 策略调度器、effectScore 闭环——全部代码公开，MIT 许可。',
  },
  {
    icon: Lock,
    label: '隐私第一',
    detail: '学生数据本地存储，AI 推理在设备端完成。不上传原始错题图片，只传匿名化的认知向量。',
  },
  {
    icon: Globe,
    label: '多语言架构',
    detail: '知识图谱和认知模型与语言解耦。目前支持中文学科，英文和其他语言的适配已在路线图中。',
  },
];

const OpenSource: React.FC = () => (
  <section id="open-source" className="relative py-24 sm:py-32">
    <div className="mx-auto max-w-6xl px-6">
      <div className="overflow-hidden rounded-3xl border border-[var(--aiu-line)] bg-gradient-to-br from-[var(--aiu-ocean-deep)] to-[#1a2744] p-8 shadow-[0_20px_60px_rgba(13,31,51,0.2)] sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
              <Github size={20} />
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-sky-deep)]">
              Open Source
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">
            教育引擎应该是公共基础设施
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-blue-100/70">
            就像可汗学院让视频课免费、维基百科让知识免费一样，
            AIU 要让<strong className="text-white">个性化认知建模</strong>免费。
            不是因为它不值钱——恰恰相反，它太重要了，不应该只有付费用户才能用。
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {FACTS.map((fact, index) => {
            const Icon = fact.icon;
            return (
              <motion.div
                key={fact.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="rounded-2xl border border-white/8 bg-white/5 p-5 backdrop-blur"
              >
                <Icon size={18} className="text-[var(--aiu-sky-deep)]" />
                <h3 className="mt-3 text-base font-extrabold text-white">{fact.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-blue-100/60">{fact.detail}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[var(--aiu-ocean-deep)] shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
          >
            <Github size={16} />
            查看源代码
          </a>
          <span className="text-sm text-blue-100/50">MIT License / 自由使用、修改、分发</span>
        </motion.div>
      </div>
    </div>
  </section>
);

export default OpenSource;
