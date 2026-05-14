"""
高级评测器模块
实现语义相似度、ROUGE、BLEU、多模型交叉验证等评测方法
"""

import re
from typing import Dict, List, Tuple, Any, Optional
import numpy as np


class SemanticEvaluator:
    """语义相似度评测器（基于 Sentence Transformers）"""

    def __init__(self):
        self._model = None

    def _load_model(self):
        """延迟加载模型"""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                # 使用支持中文的多语言模型
                self._model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            except Exception as e:
                raise RuntimeError(f"加载语义相似度模型失败: {e}")

    def evaluate(self, answer: str, expected: str) -> Tuple[float, str, Dict[str, Any]]:
        """
        计算语义相似度

        Returns:
            (score, reason, metadata)
        """
        self._load_model()

        try:
            from sklearn.metrics.pairwise import cosine_similarity

            # 编码文本
            embeddings = self._model.encode([answer, expected])

            # 计算余弦相似度
            similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]

            # 转换为 0-1 范围
            score = float(max(0.0, min(1.0, similarity)))

            reason = f"语义相似度: {score:.3f}"
            metadata = {
                "method": "semantic_similarity",
                "model": "paraphrase-multilingual-MiniLM-L12-v2"
            }

            return score, reason, metadata

        except Exception as e:
            return 0.0, f"语义相似度计算失败: {str(e)}", {}


class RougeEvaluator:
    """ROUGE 评测器（适用于中文）"""

    def __init__(self):
        self._initialized = False

    def _init_jieba(self):
        """初始化 jieba 分词"""
        if not self._initialized:
            import jieba
            jieba.setLogLevel(20)  # 减少日志输出
            self._initialized = True

    def _tokenize(self, text: str) -> List[str]:
        """中文分词"""
        import jieba
        return list(jieba.cut(text.strip()))

    def evaluate(self, answer: str, expected: str) -> Tuple[float, str, Dict[str, Any]]:
        """
        计算 ROUGE-L 分数

        Returns:
            (score, reason, metadata)
        """
        self._init_jieba()

        try:
            # 分词
            answer_tokens = self._tokenize(answer)
            expected_tokens = self._tokenize(expected)

            # 计算 ROUGE-L (最长公共子序列)
            lcs_length = self._lcs_length(answer_tokens, expected_tokens)

            if len(answer_tokens) == 0 or len(expected_tokens) == 0:
                return 0.0, "文本为空", {}

            # 计算精确率和召回率
            precision = lcs_length / len(answer_tokens) if len(answer_tokens) > 0 else 0
            recall = lcs_length / len(expected_tokens) if len(expected_tokens) > 0 else 0

            # F1 分数
            if precision + recall > 0:
                f1 = 2 * precision * recall / (precision + recall)
            else:
                f1 = 0.0

            score = float(max(0.0, min(1.0, f1)))

            reason = f"ROUGE-L: P={precision:.3f}, R={recall:.3f}, F1={score:.3f}"
            metadata = {
                "method": "rouge_l",
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "lcs_length": lcs_length
            }

            return score, reason, metadata

        except Exception as e:
            return 0.0, f"ROUGE 计算失败: {str(e)}", {}

    def _lcs_length(self, seq1: List[str], seq2: List[str]) -> int:
        """计算最长公共子序列长度"""
        m, n = len(seq1), len(seq2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]

        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if seq1[i-1] == seq2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])

        return dp[m][n]


class BleuEvaluator:
    """BLEU 评测器"""

    def __init__(self):
        self._initialized = False

    def _init_jieba(self):
        """初始化 jieba 分词"""
        if not self._initialized:
            import jieba
            jieba.setLogLevel(20)
            self._initialized = True

    def _tokenize(self, text: str) -> List[str]:
        """中文分词"""
        import jieba
        return list(jieba.cut(text.strip()))

    def evaluate(self, answer: str, expected: str) -> Tuple[float, str, Dict[str, Any]]:
        """
        计算 BLEU 分数

        Returns:
            (score, reason, metadata)
        """
        self._init_jieba()

        try:
            # 分词
            answer_tokens = self._tokenize(answer)
            expected_tokens = self._tokenize(expected)

            if len(answer_tokens) == 0 or len(expected_tokens) == 0:
                return 0.0, "文本为空", {}

            # 计算 BLEU-4 (1-gram 到 4-gram)
            weights = [0.25, 0.25, 0.25, 0.25]
            precisions = []

            for n in range(1, 5):
                precision = self._ngram_precision(answer_tokens, expected_tokens, n)
                precisions.append(precision)

            # 几何平均
            if all(p > 0 for p in precisions):
                bleu = np.exp(sum(w * np.log(p) for w, p in zip(weights, precisions)))
            else:
                bleu = 0.0

            # 长度惩罚
            bp = self._brevity_penalty(len(answer_tokens), len(expected_tokens))
            score = float(max(0.0, min(1.0, bp * bleu)))

            reason = f"BLEU-4: {score:.3f} (BP={bp:.3f})"
            metadata = {
                "method": "bleu_4",
                "precisions": [round(p, 3) for p in precisions],
                "brevity_penalty": round(bp, 3)
            }

            return score, reason, metadata

        except Exception as e:
            return 0.0, f"BLEU 计算失败: {str(e)}", {}

    def _ngram_precision(self, candidate: List[str], reference: List[str], n: int) -> float:
        """计算 n-gram 精确率"""
        if len(candidate) < n:
            return 0.0

        # 生成 n-grams
        candidate_ngrams = [tuple(candidate[i:i+n]) for i in range(len(candidate) - n + 1)]
        reference_ngrams = [tuple(reference[i:i+n]) for i in range(len(reference) - n + 1)]

        if len(candidate_ngrams) == 0:
            return 0.0

        # 计数
        from collections import Counter
        candidate_counts = Counter(candidate_ngrams)
        reference_counts = Counter(reference_ngrams)

        # 匹配数量
        matches = sum(min(candidate_counts[ng], reference_counts[ng]) for ng in candidate_counts)

        return matches / len(candidate_ngrams)

    def _brevity_penalty(self, candidate_len: int, reference_len: int) -> float:
        """计算长度惩罚"""
        if candidate_len >= reference_len:
            return 1.0
        return np.exp(1 - reference_len / candidate_len)


class MultiJudgeEvaluator:
    """多模型交叉验证评测器"""

    def __init__(self, llm_client, judges: Optional[List[str]] = None):
        """
        Args:
            llm_client: LLM 客户端
            judges: 评判模型列表，如 ["gpt-4", "deepseek", "glm-4"]
        """
        self.llm_client = llm_client
        self.judges = judges or ["gpt-4", "deepseek-chat", "glm-4"]

    async def evaluate(
        self,
        answer: str,
        expected: str,
        template_prompt: str,
        parse_func
    ) -> Tuple[float, str, Dict[str, Any]]:
        """
        使用多个模型评判并取平均分

        Args:
            answer: 实际答案
            expected: 期望答案
            template_prompt: 评测提示词
            parse_func: 解析函数

        Returns:
            (score, reason, metadata)
        """
        scores = {}
        reasons = {}

        for judge in self.judges:
            try:
                # 调用 LLM 评判
                raw_result = await self.llm_client.chat(
                    messages=[{"role": "user", "content": template_prompt}],
                    provider=judge.split("-")[0],  # 提取 provider
                    model=judge
                )

                # 解析结果
                score, reason, _ = parse_func(raw_result)
                scores[judge] = score
                reasons[judge] = reason

            except Exception as e:
                # 某个模型失败不影响其他模型
                scores[judge] = None
                reasons[judge] = f"评测失败: {str(e)}"

        # 计算平均分（忽略失败的）
        valid_scores = [s for s in scores.values() if s is not None]

        if not valid_scores:
            return 0.0, "所有评判模型均失败", {"judges": scores}

        avg_score = float(np.mean(valid_scores))

        # 构建原因说明
        reason_parts = [f"{judge}: {score:.3f}" for judge, score in scores.items() if score is not None]
        reason = f"多模型平均分: {avg_score:.3f} ({', '.join(reason_parts)})"

        metadata = {
            "method": "multi_judge",
            "judges": list(scores.keys()),
            "scores": scores,
            "reasons": reasons,
            "avg_score": round(avg_score, 3),
            "valid_count": len(valid_scores)
        }

        return avg_score, reason, metadata


class CostCalculator:
    """成本计算器"""

    # 各模型的定价（美元/1K tokens）
    PRICING = {
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "deepseek-chat": {"input": 0.0001, "output": 0.0002},
        "glm-4": {"input": 0.001, "output": 0.001},
    }

    @classmethod
    def calculate_cost(cls, model: str, input_tokens: int, output_tokens: int) -> float:
        """
        计算成本

        Args:
            model: 模型名称
            input_tokens: 输入 token 数
            output_tokens: 输出 token 数

        Returns:
            成本（美元）
        """
        # 查找匹配的定价
        pricing = None
        for model_key, price in cls.PRICING.items():
            if model_key in model.lower():
                pricing = price
                break

        if not pricing:
            # 默认定价
            pricing = {"input": 0.001, "output": 0.002}

        cost = (input_tokens / 1000 * pricing["input"] +
                output_tokens / 1000 * pricing["output"])

        return round(cost, 6)

    @classmethod
    def estimate_tokens(cls, text: str) -> int:
        """
        估算 token 数量（粗略估计）
        中文：1个字约等于1.5个token
        英文：1个单词约等于1.3个token
        """
        # 统计中文字符
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        # 统计英文单词
        english_words = len(re.findall(r'[a-zA-Z]+', text))
        # 其他字符
        other_chars = len(text) - chinese_chars - sum(len(w) for w in re.findall(r'[a-zA-Z]+', text))

        tokens = int(chinese_chars * 1.5 + english_words * 1.3 + other_chars * 0.5)
        return max(tokens, 1)
