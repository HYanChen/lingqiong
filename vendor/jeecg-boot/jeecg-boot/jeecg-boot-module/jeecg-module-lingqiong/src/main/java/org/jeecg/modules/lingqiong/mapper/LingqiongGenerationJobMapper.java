package org.jeecg.modules.lingqiong.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Update;
import org.jeecg.modules.lingqiong.entity.LingqiongGenerationJob;

@Mapper
public interface LingqiongGenerationJobMapper extends BaseMapper<LingqiongGenerationJob> {
    @Update("UPDATE generation_jobs SET status = 'queued', error = NULL, updated_at = #{updatedAt} WHERE id = #{id}")
    int retry(String id, String updatedAt);

    @Update("UPDATE generation_jobs SET status = 'cancelled', updated_at = #{updatedAt} WHERE id = #{id} AND status IN ('queued', 'running')")
    int cancel(String id, String updatedAt);
}
